import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core/columns/vector_extension/vector";

export const bookEmbeddingField = pgEnum("book_embedding_field", [
  "title",
  "description",
  "keywords",
]);

export const books = pgTable(
  "books",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    titleNormalized: text("title_normalized").notNull(),
    abstract: text("abstract").notNull(),
    searchableText: text("searchable_text").notNull(),
    coverPath: text("cover_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("books_title_normalized_idx").on(table.titleNormalized),
    index("books_title_trgm_idx").using(
      "gin",
      sql`${table.title} gin_trgm_ops`,
    ),
  ],
);

export const bookEmbeddings = pgTable(
  "book_embeddings",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    fieldName: bookEmbeddingField("field_name").notNull(),
    text: text("text").notNull(),
    textHash: text("text_hash").notNull(),
    model: text("model").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.bookId, table.fieldName],
      name: "book_embeddings_pkey",
    }),
    index("book_embeddings_field_name_idx").on(table.fieldName),
  ],
);

export const authors = pgTable(
  "authors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("authors_name_normalized_idx").on(table.nameNormalized),
    index("authors_name_trgm_idx").using(
      "gin",
      sql`${table.name} gin_trgm_ops`,
    ),
  ],
);

export const keywords = pgTable(
  "keywords",
  {
    id: serial("id").primaryKey(),
    value: text("value").notNull(),
    valueNormalized: text("value_normalized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("keywords_value_normalized_idx").on(table.valueNormalized),
    index("keywords_value_trgm_idx").using(
      "gin",
      sql`${table.value} gin_trgm_ops`,
    ),
  ],
);

export const booksAuthors = pgTable(
  "books_authors",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.bookId, table.authorId],
      name: "books_authors_pkey",
    }),
  ],
);

export const booksKeywords = pgTable(
  "books_keywords",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.bookId, table.keywordId],
      name: "books_keywords_pkey",
    }),
  ],
);

export const booksRelations = relations(books, ({ many }) => ({
  booksAuthors: many(booksAuthors),
  bookEmbeddings: many(bookEmbeddings),
  booksKeywords: many(booksKeywords),
}));

export const bookEmbeddingsRelations = relations(bookEmbeddings, ({ one }) => ({
  book: one(books, {
    fields: [bookEmbeddings.bookId],
    references: [books.id],
  }),
}));

export const authorsRelations = relations(authors, ({ many }) => ({
  booksAuthors: many(booksAuthors),
}));

export const keywordsRelations = relations(keywords, ({ many }) => ({
  booksKeywords: many(booksKeywords),
}));

export const booksAuthorsRelations = relations(booksAuthors, ({ one }) => ({
  book: one(books, {
    fields: [booksAuthors.bookId],
    references: [books.id],
  }),
  author: one(authors, {
    fields: [booksAuthors.authorId],
    references: [authors.id],
  }),
}));

export const booksKeywordsRelations = relations(booksKeywords, ({ one }) => ({
  book: one(books, {
    fields: [booksKeywords.bookId],
    references: [books.id],
  }),
  keyword: one(keywords, {
    fields: [booksKeywords.keywordId],
    references: [keywords.id],
  }),
}));
