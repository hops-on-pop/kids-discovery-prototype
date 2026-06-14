import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { openai } from "@ai-sdk/openai";
import { loadEnvConfig } from "@next/env";
import { embedMany } from "ai";

loadEnvConfig(process.cwd());

type OpenLibraryBook = {
  title: string;
  author: string;
  series?: string | null;
  openLibrary?: {
    description?: string | null;
    subjects?: string[];
    coverUrl?: string | null;
    localCoverPath?: string | null;
    firstPublishYear?: number | null;
    workKey?: string;
    editionKey?: string | null;
    isbn10?: string | null;
    isbn13?: string | null;
  };
};

type SubjectsFile = {
  subjects?: string[];
};

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
  openLibraryWorkKey: string | null;
  openLibraryEditionKey: string | null;
  isbn10: string | null;
  isbn13: string | null;
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

type EmbeddingJob = {
  rowIndex: number;
  field: "titleEmbedding" | "descriptionEmbedding" | "keywordsEmbedding";
  textKey:
    | "titleEmbeddingText"
    | "descriptionEmbeddingText"
    | "keywordsEmbeddingText";
  hashKey:
    | "titleEmbeddingHash"
    | "descriptionEmbeddingHash"
    | "keywordsEmbeddingHash";
  text: string;
  hash: string;
};

const DEFAULT_INPUT = "data/children_books_openlibrary.json";
const DEFAULT_SUBJECTS = "data/children_books_subjects.json";
const DEFAULT_OUTPUT = "data/children_books_embeddings.jsonl";
const DEFAULT_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

function printHelp() {
  console.log(`Usage: bun run scripts/generate-book-embeddings.ts [options]

Options:
  --input <path>        Enriched Open Library JSON. Default: ${DEFAULT_INPUT}
  --subjects <path>     Optional cleaned subjects JSON. Default: ${DEFAULT_SUBJECTS}
  --output <path>       Embedding cache JSONL. Default: ${DEFAULT_OUTPUT}
  --model <model>       OpenAI embedding model. Default: ${DEFAULT_MODEL}
  --batch-size <n>      Number of field texts per API call. Default: 16
  --delay-ms <n>        Delay between API calls. Default: 1000
  --max-retries <n>     AI SDK retries per API call. Default: 3
  --max-keywords <n>    Max keywords embedded per book. Default: 12
  --limit <n>           Process only the first N books.
  --dry-run             Build rows and report work without calling OpenAI.
  --help                Show this help.`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT,
    subjects: DEFAULT_SUBJECTS,
    output: DEFAULT_OUTPUT,
    model: DEFAULT_MODEL,
    batchSize: 16,
    delayMs: 1000,
    maxRetries: 3,
    maxKeywords: 12,
    limit: Number.POSITIVE_INFINITY,
    dryRun: false,
  };

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

    const next = args[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--input") {
      options.input = next;
    } else if (arg === "--subjects") {
      options.subjects = next;
    } else if (arg === "--output") {
      options.output = next;
    } else if (arg === "--model") {
      options.model = next;
    } else if (arg === "--batch-size") {
      options.batchSize = Number(next);
    } else if (arg === "--delay-ms") {
      options.delayMs = Number(next);
    } else if (arg === "--max-retries") {
      options.maxRetries = Number(next);
    } else if (arg === "--max-keywords") {
      options.maxKeywords = Number(next);
    } else if (arg === "--limit") {
      options.limit = Number(next);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  if (!Number.isFinite(options.batchSize) || options.batchSize < 1) {
    throw new Error("--batch-size must be a positive number.");
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number.");
  }

  if (!Number.isFinite(options.maxRetries) || options.maxRetries < 0) {
    throw new Error("--max-retries must be a non-negative number.");
  }

  if (!Number.isFinite(options.maxKeywords) || options.maxKeywords < 0) {
    throw new Error("--max-keywords must be a non-negative number.");
  }

  if (
    !Number.isFinite(options.limit) &&
    options.limit !== Number.POSITIVE_INFINITY
  ) {
    throw new Error("--limit must be a number.");
  }

  return options;
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2018\u2019]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function bookKey(book: OpenLibraryBook) {
  return `${normalize(book.title)}|${normalize(book.author)}|${normalize(
    book.series ?? "",
  )}`;
}

function dedupeSubjects(subjects: string[]) {
  const byKey = new Map<string, string>();

  for (const subject of subjects) {
    const trimmed = cleanText(subject);
    const key = normalize(trimmed);

    if (trimmed && key && !byKey.has(key)) {
      byKey.set(key, trimmed);
    }
  }

  return [...byKey.values()];
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readSubjects(filePath: string) {
  try {
    const data = await readJson<SubjectsFile>(filePath);
    const subjects = data.subjects ?? [];

    return new Map(
      dedupeSubjects(subjects).map((subject) => [normalize(subject), subject]),
    );
  } catch {
    return new Map<string, string>();
  }
}

async function readExistingRows(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as EmbeddingCacheRow);

    return new Map(rows.map((row) => [row.bookKey, row]));
  } catch {
    return new Map<string, EmbeddingCacheRow>();
  }
}

function selectKeywords(
  book: OpenLibraryBook,
  canonicalSubjects: Map<string, string>,
  maxKeywords: number,
) {
  const subjects = dedupeSubjects(book.openLibrary?.subjects ?? []);
  const keywords = subjects.map((subject) => {
    const key = normalize(subject);
    return canonicalSubjects.get(key) ?? subject;
  });

  return dedupeSubjects(keywords).slice(0, maxKeywords);
}

function buildBaseRow(
  book: OpenLibraryBook,
  keywords: string[],
  model: string,
): EmbeddingCacheRow {
  const abstract = cleanText(book.openLibrary?.description);
  const titleEmbeddingText = cleanText(book.title);
  const descriptionEmbeddingText = abstract || null;
  const keywordsEmbeddingText = keywords.length ? keywords.join(", ") : null;

  return {
    bookKey: bookKey(book),
    title: book.title,
    author: book.author,
    series: book.series ?? null,
    abstract,
    keywords,
    coverUrl: book.openLibrary?.coverUrl ?? null,
    localCoverPath: book.openLibrary?.localCoverPath ?? null,
    firstPublishYear: book.openLibrary?.firstPublishYear ?? null,
    openLibraryWorkKey: book.openLibrary?.workKey ?? null,
    openLibraryEditionKey: book.openLibrary?.editionKey ?? null,
    isbn10: book.openLibrary?.isbn10 ?? null,
    isbn13: book.openLibrary?.isbn13 ?? null,
    embeddingModel: model,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    titleEmbeddingText,
    titleEmbeddingHash: hashText(titleEmbeddingText),
    titleEmbedding: null,
    descriptionEmbeddingText,
    descriptionEmbeddingHash: descriptionEmbeddingText
      ? hashText(descriptionEmbeddingText)
      : null,
    descriptionEmbedding: null,
    keywordsEmbeddingText,
    keywordsEmbeddingHash: keywordsEmbeddingText
      ? hashText(keywordsEmbeddingText)
      : null,
    keywordsEmbedding: null,
  };
}

function reuseEmbedding(
  row: EmbeddingCacheRow,
  existing: EmbeddingCacheRow | undefined,
  field: EmbeddingJob["field"],
  hashKey: EmbeddingJob["hashKey"],
) {
  if (
    existing?.embeddingModel === row.embeddingModel &&
    existing.embeddingDimensions === row.embeddingDimensions &&
    existing[hashKey] === row[hashKey] &&
    Array.isArray(existing[field]) &&
    existing[field]?.length === row.embeddingDimensions
  ) {
    row[field] = existing[field] as number[] & null;
    return true;
  }

  return false;
}

function queueField(
  jobs: EmbeddingJob[],
  rows: EmbeddingCacheRow[],
  rowIndex: number,
  field: EmbeddingJob["field"],
  textKey: EmbeddingJob["textKey"],
  hashKey: EmbeddingJob["hashKey"],
) {
  const row = rows[rowIndex];
  const text = row[textKey];
  const hash = row[hashKey];

  if (!text || !hash || row[field]) {
    return;
  }

  jobs.push({ rowIndex, field, textKey, hashKey, text, hash });
}

async function embedJobs(
  rows: EmbeddingCacheRow[],
  jobs: EmbeddingJob[],
  options: {
    batchSize: number;
    delayMs: number;
    maxRetries: number;
    model: string;
  },
) {
  const model = openai.embedding(options.model);

  for (let start = 0; start < jobs.length; start += options.batchSize) {
    const batch = jobs.slice(start, start + options.batchSize);
    const batchNumber = Math.floor(start / options.batchSize) + 1;
    const batchCount = Math.ceil(jobs.length / options.batchSize);

    process.stdout.write(
      `Embedding batch ${batchNumber}/${batchCount} (${batch.length} fields)... `,
    );

    const result = await embedMany({
      model,
      values: batch.map((job) => job.text),
      maxParallelCalls: 1,
      maxRetries: options.maxRetries,
    });

    for (const [index, embedding] of result.embeddings.entries()) {
      const job = batch[index];
      const row = rows[job.rowIndex];

      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Expected ${EMBEDDING_DIMENSIONS} dimensions for ${row.title} ${job.field}, got ${embedding.length}.`,
        );
      }

      row[job.field] = embedding as number[] & null;
    }

    console.log("done");

    if (start + options.batchSize < jobs.length && options.delayMs > 0) {
      await delay(options.delayMs);
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs();

  if (!options.dryRun && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required unless --dry-run is used.");
  }

  const [books, canonicalSubjects, existingRows] = await Promise.all([
    readJson<OpenLibraryBook[]>(options.input),
    readSubjects(options.subjects),
    readExistingRows(options.output),
  ]);

  const selectedBooks = books.slice(0, options.limit);
  const rows = selectedBooks.map((book) =>
    buildBaseRow(
      book,
      selectKeywords(book, canonicalSubjects, options.maxKeywords),
      options.model,
    ),
  );
  const jobs: EmbeddingJob[] = [];
  let reused = 0;

  for (const [rowIndex, row] of rows.entries()) {
    const existing = existingRows.get(row.bookKey);

    reused += reuseEmbedding(
      row,
      existing,
      "titleEmbedding",
      "titleEmbeddingHash",
    )
      ? 1
      : 0;
    reused += reuseEmbedding(
      row,
      existing,
      "descriptionEmbedding",
      "descriptionEmbeddingHash",
    )
      ? 1
      : 0;
    reused += reuseEmbedding(
      row,
      existing,
      "keywordsEmbedding",
      "keywordsEmbeddingHash",
    )
      ? 1
      : 0;

    queueField(
      jobs,
      rows,
      rowIndex,
      "titleEmbedding",
      "titleEmbeddingText",
      "titleEmbeddingHash",
    );
    queueField(
      jobs,
      rows,
      rowIndex,
      "descriptionEmbedding",
      "descriptionEmbeddingText",
      "descriptionEmbeddingHash",
    );
    queueField(
      jobs,
      rows,
      rowIndex,
      "keywordsEmbedding",
      "keywordsEmbeddingText",
      "keywordsEmbeddingHash",
    );
  }

  console.log(`Prepared ${rows.length} books.`);
  console.log(`Reused ${reused} existing field embeddings.`);
  console.log(`Need to generate ${jobs.length} field embeddings.`);

  if (options.dryRun) {
    console.log("Dry run complete; no OpenAI calls made and no file written.");
    return;
  }

  await embedJobs(rows, jobs, options);

  const output = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(path.resolve(options.output), `${output}\n`);

  console.log(`Wrote ${rows.length} rows to ${options.output}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
