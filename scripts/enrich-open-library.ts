import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SeedBook = {
  title: string;
  author: string;
  series?: string | null;
  series_index?: number | null;
};

type SeedFile = SeedBook[] | { books: SeedBook[] };

type OpenLibrarySearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_key?: string[];
  isbn?: string[];
  language?: string[];
  subject?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
  edition_count?: number;
};

type OpenLibraryWork = {
  description?: string | { value?: string };
  subjects?: string[];
};

type SearchMatch = {
  doc: OpenLibrarySearchDoc;
  score: number;
  searchTitle: string;
  searchMode: "fielded" | "full-text";
};

type EnrichedBook = SeedBook & {
  matchStatus: "matched" | "unmatched";
  matchScore: number;
  openLibrary?: {
    workKey: string;
    editionKey: string | null;
    coverId: number | null;
    coverUrl: string | null;
    localCoverPath: string | null;
    isbn10: string | null;
    isbn13: string | null;
    firstPublishYear: number | null;
    language: string[];
    subjects: string[];
    publishers: string[];
    pageCount: number | null;
    ratingsAverage: number | null;
    ratingsCount: number | null;
    editionCount: number | null;
    description: string | null;
  };
  sourceErrors?: string[];
};

const DEFAULT_INPUT = "data/children_books_seed.json";
const DEFAULT_OUTPUT = "data/children_books_openlibrary.json";
const DEFAULT_COVER_DIR = "public/book-covers";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";
const COVERS_BASE = "https://covers.openlibrary.org";

function printHelp() {
  console.log(`Usage: bun run scripts/enrich-open-library.ts [options]

Options:
  --input <path>          Seed JSON file. Default: ${DEFAULT_INPUT}
  --output <path>         Enriched JSON file. Default: ${DEFAULT_OUTPUT}
  --download-covers       Download matched cover thumbnails into public/book-covers.
  --update                Refresh metadata and only download missing local covers.
  --cover-dir <path>      Cover output directory. Default: ${DEFAULT_COVER_DIR}
  --limit <number>        Process only the first N books.
  --delay-ms <number>     Delay between books. Default: 250
  --help                  Show this help.

Seed files may be either a top-level array or an object with a books array.`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    coverDir: DEFAULT_COVER_DIR,
    downloadCovers: false,
    skipExistingCovers: false,
    limit: Number.POSITIVE_INFINITY,
    delayMs: 250,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--download-covers") {
      options.downloadCovers = true;
      continue;
    }

    if (arg === "--update") {
      options.downloadCovers = true;
      options.skipExistingCovers = true;
      continue;
    }

    const next = args[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--input") {
      options.input = next;
    } else if (arg === "--output") {
      options.output = next;
    } else if (arg === "--cover-dir") {
      options.coverDir = next;
    } else if (arg === "--limit") {
      options.limit = Number(next);
    } else if (arg === "--delay-ms") {
      options.delayMs = Number(next);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  if (
    !Number.isFinite(options.limit) &&
    options.limit !== Number.POSITIVE_INFINITY
  ) {
    throw new Error("--limit must be a number");
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
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

function scoreDoc(seed: SeedBook, doc: OpenLibrarySearchDoc) {
  const seedTitle = normalize(seed.title);
  const docTitle = normalize(doc.title ?? "");
  const seedAuthor = normalize(seed.author);
  const docAuthors = (doc.author_name ?? []).map(normalize);

  let score = 0;

  if (docTitle === seedTitle) {
    score += 100;
  } else if (docTitle.includes(seedTitle) || seedTitle.includes(docTitle)) {
    score += 55;
  }

  if (docAuthors.some((author) => author === seedAuthor)) {
    score += 80;
  } else if (
    docAuthors.some(
      (author) => author.includes(seedAuthor) || seedAuthor.includes(author),
    )
  ) {
    score += 45;
  }

  if (doc.cover_i) {
    score += 15;
  }

  if (doc.isbn?.some((isbn) => isbn.length === 13)) {
    score += 10;
  }

  if (doc.edition_key?.length) {
    score += 5;
  }

  return score;
}

function titleVariants(seed: SeedBook) {
  const variants = [seed.title];
  const colonTitle = seed.title.match(/^[^:]+:\s+(.+)$/)?.[1];
  const numberedTitle = seed.title.match(/^.+\s+#\d+:\s+(.+)$/)?.[1];

  if (seed.series) {
    const seriesPrefix = new RegExp(
      `^${escapeRegExp(seed.series)}\\s*:\\s*(.+)$`,
      "i",
    );
    const seriesTitle = seed.title.match(seriesPrefix)?.[1];

    if (seriesTitle) {
      variants.push(seriesTitle);
    }
  }

  if (numberedTitle) {
    variants.push(numberedTitle);
  }

  if (colonTitle) {
    variants.push(colonTitle);
  }

  return [...new Set(variants.map((title) => title.trim()).filter(Boolean))];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chooseIsbn(isbns: string[] | undefined, length: 10 | 13) {
  return (
    isbns?.find((isbn) => isbn.replace(/[^0-9X]/gi, "").length === length) ??
    null
  );
}

function coverUrl(coverId: number) {
  return `${COVERS_BASE}/b/id/${coverId}-M.jpg?default=false`;
}

function expectedCoverPath(seed: SeedBook, coverDir: string) {
  return path.join(coverDir, `${slugify(seed)}.jpg`);
}

function slugify(seed: SeedBook) {
  return normalize(`${seed.title}-${seed.author}`)
    .replace(/\s+/g, "-")
    .slice(0, 90);
}

function getDescription(work: OpenLibraryWork) {
  if (typeof work.description === "string") {
    return work.description;
  }

  return work.description?.value ?? null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "kids-discovery-prototype/0.1 data enrichment",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function searchFields() {
  return [
    "key",
    "title",
    "author_name",
    "first_publish_year",
    "cover_i",
    "edition_key",
    "isbn",
    "language",
    "subject",
    "publisher",
    "number_of_pages_median",
    "ratings_average",
    "ratings_count",
    "edition_count",
  ].join(",");
}

async function searchOpenLibraryByTitle(seed: SeedBook, title: string) {
  const params = new URLSearchParams({
    title,
    author: seed.author,
    limit: "8",
    fields: searchFields(),
  });
  const result = await fetchJson<{ docs: OpenLibrarySearchDoc[] }>(
    `${OPEN_LIBRARY_BASE}/search.json?${params.toString()}`,
  );

  return result.docs
    .map((doc) => ({
      doc,
      score: scoreDoc({ ...seed, title }, doc),
      searchTitle: title,
      searchMode: "fielded" as const,
    }))
    .sort((a, b) => b.score - a.score)[0];
}

async function searchOpenLibraryFullText(seed: SeedBook, title: string) {
  const params = new URLSearchParams({
    q: `${title} ${seed.author}`,
    limit: "12",
    fields: searchFields(),
  });
  const result = await fetchJson<{ docs: OpenLibrarySearchDoc[] }>(
    `${OPEN_LIBRARY_BASE}/search.json?${params.toString()}`,
  );

  return result.docs
    .map((doc) => ({
      doc,
      score: scoreDoc({ ...seed, title }, doc),
      searchTitle: title,
      searchMode: "full-text" as const,
    }))
    .sort((a, b) => b.score - a.score)[0];
}

async function searchOpenLibrary(seed: SeedBook) {
  let bestMatch: SearchMatch | undefined;
  const variants = titleVariants(seed);

  for (const title of variants) {
    const match = await searchOpenLibraryByTitle(seed, title);

    if (!bestMatch || (match && match.score > bestMatch.score)) {
      bestMatch = match;
    }

    if (bestMatch && bestMatch.score >= 180) {
      break;
    }
  }

  if (!bestMatch || bestMatch.score < 80) {
    for (const title of variants) {
      const match = await searchOpenLibraryFullText(seed, title);

      if (!bestMatch || (match && match.score > bestMatch.score)) {
        bestMatch = match;
      }

      if (bestMatch && bestMatch.score >= 180) {
        break;
      }
    }
  }

  return bestMatch;
}

async function fetchWork(workKey: string) {
  return fetchJson<OpenLibraryWork>(`${OPEN_LIBRARY_BASE}${workKey}.json`);
}

async function downloadCover(seed: SeedBook, url: string, coverDir: string) {
  await mkdir(coverDir, { recursive: true });
  const outputPath = expectedCoverPath(seed, coverDir);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "kids-discovery-prototype/0.1 cover cache",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);

  return outputPath;
}

async function fileExists(filePath: string | null | undefined) {
  if (!filePath) {
    return false;
  }

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadSeedBooks(inputPath: string) {
  const raw = await readFile(inputPath, "utf8");
  const seed = JSON.parse(raw) as SeedFile;
  const books = Array.isArray(seed) ? seed : seed.books;

  if (!Array.isArray(books)) {
    throw new Error(
      "Seed file must be a JSON array or an object with a books array.",
    );
  }

  return books;
}

async function loadExistingEnrichedBooks(outputPath: string) {
  try {
    const raw = await readFile(outputPath, "utf8");
    const books = JSON.parse(raw) as EnrichedBook[];
    return Array.isArray(books) ? books : [];
  } catch {
    return [];
  }
}

function bookKey(book: SeedBook) {
  return `${normalize(book.title)}|${normalize(book.author)}|${normalize(book.series ?? "")}`;
}

async function enrichBook(
  seed: SeedBook,
  options: {
    coverDir: string;
    downloadCovers: boolean;
    skipExistingCovers: boolean;
    existingBook?: EnrichedBook;
  },
): Promise<EnrichedBook> {
  const sourceErrors: string[] = [];

  try {
    const match = await searchOpenLibrary(seed);

    if (!match?.doc.key || match.score < 80) {
      return {
        ...seed,
        matchStatus: "unmatched",
        matchScore: match?.score ?? 0,
        sourceErrors: match
          ? ["No confident Open Library match found."]
          : ["No Open Library results found."],
      };
    }

    const { doc } = match;
    const workKey = doc.key;
    if (!workKey) {
      return {
        ...seed,
        matchStatus: "unmatched",
        matchScore: match.score,
        sourceErrors: ["Open Library match did not include a work key."],
      };
    }

    let work: OpenLibraryWork | null = null;
    let localCoverPath: string | null = null;

    try {
      work = await fetchWork(workKey);
    } catch (error) {
      sourceErrors.push(`Work metadata failed: ${String(error)}`);
    }

    const remoteCoverUrl = doc.cover_i ? coverUrl(doc.cover_i) : null;

    if (options.downloadCovers && remoteCoverUrl) {
      try {
        const previousCoverPath =
          options.existingBook?.openLibrary?.localCoverPath;
        const nextCoverPath = expectedCoverPath(seed, options.coverDir);

        if (
          options.skipExistingCovers &&
          (await fileExists(previousCoverPath))
        ) {
          localCoverPath = previousCoverPath ?? null;
        } else if (
          options.skipExistingCovers &&
          (await fileExists(nextCoverPath))
        ) {
          localCoverPath = nextCoverPath;
        } else {
          localCoverPath = await downloadCover(
            seed,
            remoteCoverUrl,
            options.coverDir,
          );
        }
      } catch (error) {
        sourceErrors.push(`Cover download failed: ${String(error)}`);
      }
    }

    return {
      ...seed,
      matchStatus: "matched",
      matchScore: match.score,
      openLibrary: {
        workKey,
        editionKey: doc.edition_key?.[0]
          ? `/books/${doc.edition_key[0]}`
          : null,
        coverId: doc.cover_i ?? null,
        coverUrl: remoteCoverUrl,
        localCoverPath,
        isbn10: chooseIsbn(doc.isbn, 10),
        isbn13: chooseIsbn(doc.isbn, 13),
        firstPublishYear: doc.first_publish_year ?? null,
        language: doc.language?.slice(0, 8) ?? [],
        subjects: (work?.subjects ?? doc.subject ?? []).slice(0, 24),
        publishers: doc.publisher?.slice(0, 8) ?? [],
        pageCount: doc.number_of_pages_median ?? null,
        ratingsAverage: doc.ratings_average ?? null,
        ratingsCount: doc.ratings_count ?? null,
        editionCount: doc.edition_count ?? null,
        description: work ? getDescription(work) : null,
      },
      ...(sourceErrors.length > 0 ? { sourceErrors } : {}),
    };
  } catch (error) {
    return {
      ...seed,
      matchStatus: "unmatched",
      matchScore: 0,
      sourceErrors: [`Open Library lookup failed: ${String(error)}`],
    };
  }
}

async function main() {
  const options = parseArgs();
  const seedBooks = (await loadSeedBooks(options.input)).slice(
    0,
    options.limit,
  );
  const existingBooks = await loadExistingEnrichedBooks(options.output);
  const existingByKey = new Map(
    existingBooks.map((book) => [bookKey(book), book]),
  );
  const enriched: EnrichedBook[] = [];

  for (const [index, seed] of seedBooks.entries()) {
    const label = `${index + 1}/${seedBooks.length} ${seed.title} by ${seed.author}`;
    process.stdout.write(`Fetching ${label}... `);

    const result = await enrichBook(seed, {
      ...options,
      existingBook: existingByKey.get(bookKey(seed)),
    });
    enriched.push(result);

    console.log(`${result.matchStatus} (${result.matchScore})`);

    if (index < seedBooks.length - 1) {
      await delay(options.delayMs);
    }
  }

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(enriched, null, 2)}\n`);

  const matched = enriched.filter(
    (book) => book.matchStatus === "matched",
  ).length;
  const covers = enriched.filter(
    (book) => book.openLibrary?.localCoverPath,
  ).length;

  console.log(`Wrote ${options.output}`);
  console.log(`Matched ${matched}/${enriched.length} books.`);

  if (options.downloadCovers) {
    console.log(
      `Local covers available for ${covers} books in ${options.coverDir}.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
