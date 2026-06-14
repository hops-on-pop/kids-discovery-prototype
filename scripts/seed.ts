import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

loadEnvConfig(process.cwd());

// Imported after loadEnvConfig because src/db throws when DATABASE_URL is unset.
const { db, sql: client } = await import("../src/db");
const {
  authors,
  bookEmbeddings,
  books,
  booksAuthors,
  booksKeywords,
  keywords,
} = await import("../src/db/schema");

const DEFAULT_INPUT = "data/children_books_embeddings.jsonl";
const EMBEDDING_DIMENSIONS = 1536;

type FieldName = "title" | "description" | "keywords";

type EmbeddingCacheRow = {
  bookKey: string;
  title: string;
  author: string;
  series: string | null;
  abstract: string;
  keywords: string[];
  coverUrl: string | null;
  localCoverPath: string | null;
  firstPublishYear: number | null;
  embeddingModel: string;
  embeddingDimensions: number;
  titleEmbeddingText: string;
  titleEmbeddingHash: string;
  titleEmbedding: number[] | null;
  descriptionEmbeddingText: string | null;
  descriptionEmbeddingHash: string | null;
  descriptionEmbedding: number[] | null;
  keywordsEmbeddingText: string | null;
  keywordsEmbeddingHash: string | null;
  keywordsEmbedding: number[] | null;
};

function printHelp() {
  console.log(`Usage: bun run scripts/seed.ts [options]

Reads the cached embeddings JSONL and loads it into PostgreSQL. This is a
destructive, repeatable refresh: it truncates all catalog tables and reloads
from the local cache.

Options:
  --input <path>   Embedding cache JSONL. Default: ${DEFAULT_INPUT}
  --dry-run        Parse and validate without writing to the database.
  --help           Show this help.`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { input: DEFAULT_INPUT, dryRun: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--input") {
      const next = args[index + 1];
      if (!next) {
        throw new Error("Missing value for --input");
      }
      options.input = next;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

// Must match the normalization used in generate-book-embeddings.ts so that
// normalized keys are stable across the pipeline.
function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['‘’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

// public/ is served at the web root by Next.js, so "public/book-covers/x.jpg"
// becomes "/book-covers/x.jpg".
function toCoverPath(localCoverPath: string | null) {
  if (!localCoverPath) {
    return null;
  }
  return `/${localCoverPath.replace(/^public\//, "")}`;
}

function buildSearchableText(row: EmbeddingCacheRow) {
  return [row.title, row.author, row.abstract, row.keywords.join(", ")]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join("\n");
}

async function readRows(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EmbeddingCacheRow);
}

function isValidEmbedding(embedding: number[] | null): embedding is number[] {
  return Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS;
}

type Warnings = {
  missingTitle: number;
  missingAbstract: number;
  duplicateTitle: number;
  noEmbeddings: number;
  missingFieldEmbedding: number;
};

async function main() {
  const options = parseArgs();
  const rows = await readRows(options.input);
  console.log(`Read ${rows.length} cached rows from ${options.input}.`);

  const warnings: Warnings = {
    missingTitle: 0,
    missingAbstract: 0,
    duplicateTitle: 0,
    noEmbeddings: 0,
    missingFieldEmbedding: 0,
  };

  const seenTitles = new Set<string>();
  const authorNames = new Map<string, string>(); // normalized -> display
  const keywordValues = new Map<string, string>(); // normalized -> display

  type PreparedBook = {
    title: string;
    titleNormalized: string;
    abstract: string;
    searchableText: string;
    coverPath: string | null;
    authorNormalized: string | null;
    keywordNormalized: string[];
    embeddings: {
      fieldName: FieldName;
      text: string;
      textHash: string;
      model: string;
      embedding: number[];
    }[];
  };

  const prepared: PreparedBook[] = [];

  for (const row of rows) {
    const title = cleanText(row.title);
    if (!title) {
      warnings.missingTitle += 1;
      console.warn(`Skipping row with missing title (bookKey=${row.bookKey}).`);
      continue;
    }

    const titleNormalized = normalize(title);
    if (seenTitles.has(titleNormalized)) {
      warnings.duplicateTitle += 1;
      console.warn(`Skipping duplicate title: "${title}".`);
      continue;
    }
    seenTitles.add(titleNormalized);

    const abstract = cleanText(row.abstract);
    if (!abstract) {
      warnings.missingAbstract += 1;
    }

    // Authors.
    const authorDisplay = cleanText(row.author);
    let authorNormalized: string | null = null;
    if (authorDisplay) {
      authorNormalized = normalize(authorDisplay);
      if (authorNormalized && !authorNames.has(authorNormalized)) {
        authorNames.set(authorNormalized, authorDisplay);
      }
    }

    // Keywords.
    const keywordNormalized: string[] = [];
    for (const keyword of row.keywords ?? []) {
      const display = cleanText(keyword);
      const key = normalize(display);
      if (!key) {
        continue;
      }
      if (!keywordValues.has(key)) {
        keywordValues.set(key, display);
      }
      if (!keywordNormalized.includes(key)) {
        keywordNormalized.push(key);
      }
    }

    // Field embeddings.
    const embeddings: PreparedBook["embeddings"] = [];
    const fields: {
      fieldName: FieldName;
      text: string | null;
      hash: string | null;
      embedding: number[] | null;
    }[] = [
      {
        fieldName: "title",
        text: row.titleEmbeddingText,
        hash: row.titleEmbeddingHash,
        embedding: row.titleEmbedding,
      },
      {
        fieldName: "description",
        text: row.descriptionEmbeddingText,
        hash: row.descriptionEmbeddingHash,
        embedding: row.descriptionEmbedding,
      },
      {
        fieldName: "keywords",
        text: row.keywordsEmbeddingText,
        hash: row.keywordsEmbeddingHash,
        embedding: row.keywordsEmbedding,
      },
    ];

    for (const field of fields) {
      // A null source text means there was nothing to embed (e.g. no
      // abstract); that is expected, not an error.
      if (!field.text || !field.hash) {
        continue;
      }
      if (!isValidEmbedding(field.embedding)) {
        warnings.missingFieldEmbedding += 1;
        console.warn(
          `Missing/invalid ${field.fieldName} embedding for "${title}".`,
        );
        continue;
      }
      embeddings.push({
        fieldName: field.fieldName,
        text: field.text,
        textHash: field.hash,
        model: row.embeddingModel,
        embedding: field.embedding,
      });
    }

    if (embeddings.length === 0) {
      warnings.noEmbeddings += 1;
      console.warn(`"${title}" has no usable embeddings; inserting anyway.`);
    }

    prepared.push({
      title,
      titleNormalized,
      abstract,
      searchableText: buildSearchableText(row),
      coverPath: toCoverPath(row.localCoverPath),
      authorNormalized,
      keywordNormalized,
      embeddings,
    });
  }

  console.log(
    `Prepared ${prepared.length} books, ${authorNames.size} authors, ${keywordValues.size} keywords.`,
  );
  console.log("Warnings:", warnings);

  if (options.dryRun) {
    console.log("Dry run complete; no database writes performed.");
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      truncate table
        ${books},
        ${authors},
        ${keywords},
        ${bookEmbeddings},
        ${booksAuthors},
        ${booksKeywords}
      restart identity cascade
    `);

    // Authors.
    const authorIdByNormalized = new Map<string, number>();
    if (authorNames.size > 0) {
      const inserted = await tx
        .insert(authors)
        .values(
          [...authorNames.entries()].map(([nameNormalized, name]) => ({
            name,
            nameNormalized,
          })),
        )
        .returning({ id: authors.id, nameNormalized: authors.nameNormalized });
      for (const author of inserted) {
        authorIdByNormalized.set(author.nameNormalized, author.id);
      }
    }

    // Keywords.
    const keywordIdByNormalized = new Map<string, number>();
    if (keywordValues.size > 0) {
      const inserted = await tx
        .insert(keywords)
        .values(
          [...keywordValues.entries()].map(([valueNormalized, value]) => ({
            value,
            valueNormalized,
          })),
        )
        .returning({
          id: keywords.id,
          valueNormalized: keywords.valueNormalized,
        });
      for (const keyword of inserted) {
        keywordIdByNormalized.set(keyword.valueNormalized, keyword.id);
      }
    }

    // Books + relationships + embeddings.
    const bookAuthorRows: { bookId: number; authorId: number }[] = [];
    const bookKeywordRows: { bookId: number; keywordId: number }[] = [];
    const embeddingRows: {
      bookId: number;
      fieldName: FieldName;
      text: string;
      textHash: string;
      model: string;
      embedding: number[];
    }[] = [];

    for (const book of prepared) {
      const [insertedBook] = await tx
        .insert(books)
        .values({
          title: book.title,
          titleNormalized: book.titleNormalized,
          abstract: book.abstract,
          searchableText: book.searchableText,
          coverPath: book.coverPath,
        })
        .returning({ id: books.id });

      const bookId = insertedBook.id;

      if (book.authorNormalized) {
        const authorId = authorIdByNormalized.get(book.authorNormalized);
        if (authorId) {
          bookAuthorRows.push({ bookId, authorId });
        }
      }

      for (const keywordKey of book.keywordNormalized) {
        const keywordId = keywordIdByNormalized.get(keywordKey);
        if (keywordId) {
          bookKeywordRows.push({ bookId, keywordId });
        }
      }

      for (const embedding of book.embeddings) {
        embeddingRows.push({ bookId, ...embedding });
      }
    }

    if (bookAuthorRows.length > 0) {
      await tx.insert(booksAuthors).values(bookAuthorRows);
    }
    if (bookKeywordRows.length > 0) {
      await tx.insert(booksKeywords).values(bookKeywordRows);
    }
    if (embeddingRows.length > 0) {
      await tx.insert(bookEmbeddings).values(embeddingRows);
    }

    console.log(
      `Inserted ${prepared.length} books, ${bookAuthorRows.length} book-author links, ${bookKeywordRows.length} book-keyword links, ${embeddingRows.length} embeddings.`,
    );
  });

  await client.end();
  console.log("Seed complete.");
}

main().catch(async (error) => {
  console.error(error);
  await client.end();
  process.exit(1);
});
