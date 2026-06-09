import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";

loadEnvConfig(process.cwd());

const { db, sql } = await import("../src/db");
const { books } = await import("../src/db/schema");

const embedding = Array.from({ length: 1536 }, (_, index) =>
  index === 0 ? 1 : 0,
);
const title = `__vector_check_${Date.now()}`;

const [inserted] = await db
  .insert(books)
  .values({
    title,
    titleNormalized: title,
    abstract: "Temporary vector check row.",
    searchableText: "Temporary vector check row.",
    embedding,
  })
  .returning({ id: books.id });

if (!inserted) {
  await sql.end();
  throw new Error("Vector check insert did not return a row.");
}

try {
  const [result] = await db
    .select({
      id: books.id,
      distance: cosineDistance(books.embedding, embedding),
    })
    .from(books)
    .where(eq(books.id, inserted.id))
    .limit(1);

  const distance = Number(result?.distance);

  if (!Number.isFinite(distance) || distance > 0.000001) {
    throw new Error(`Unexpected vector distance: ${result?.distance}`);
  }

  console.log(`pgvector check passed for book id ${inserted.id}.`);
} finally {
  await db.delete(books).where(eq(books.id, inserted.id));
  await sql.end();
}
