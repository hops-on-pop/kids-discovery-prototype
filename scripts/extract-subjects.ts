import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type OpenLibraryBook = {
  openLibrary?: {
    subjects?: string[];
  };
};

const DEFAULT_INPUT = "data/children_books_openlibrary.json";
const DEFAULT_OUTPUT = "data/children_books_subjects.json";

function printHelp() {
  console.log(`Usage: bun run scripts/extract-subjects.ts [options]

Options:
  --input <path>    Open Library enriched JSON. Default: ${DEFAULT_INPUT}
  --output <path>   De-duplicated subjects output. Default: ${DEFAULT_OUTPUT}
  --help            Show this help.

Output is a JSON object with a sorted "subjects" array for downstream embedding.`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const next = args[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--input") {
      options.input = next;
    } else if (arg === "--output") {
      options.output = next;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  return options;
}

function collectSubjects(books: OpenLibraryBook[]): string[] {
  const byNormalizedKey = new Map<string, string>();

  for (const book of books) {
    for (const subject of book.openLibrary?.subjects ?? []) {
      const trimmed = subject.trim();
      if (!trimmed) continue;

      const key = trimmed.toLocaleLowerCase();
      if (!byNormalizedKey.has(key)) {
        byNormalizedKey.set(key, trimmed);
      }
    }
  }

  return [...byNormalizedKey.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

async function main() {
  const options = parseArgs();
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);

  const raw = await readFile(inputPath, "utf8");
  const books = JSON.parse(raw) as OpenLibraryBook[];
  const subjects = collectSubjects(books);

  const output = {
    source: options.input,
    count: subjects.length,
    subjects,
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(`Read ${books.length} books from ${options.input}`);
  console.log(`Wrote ${subjects.length} unique subjects to ${options.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
