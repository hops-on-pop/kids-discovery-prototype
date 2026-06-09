CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_normalized" text NOT NULL,
	"abstract" text NOT NULL,
	"searchable_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books_authors" (
	"book_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	CONSTRAINT "books_authors_pkey" PRIMARY KEY("book_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "books_keywords" (
	"book_id" integer NOT NULL,
	"keyword_id" integer NOT NULL,
	CONSTRAINT "books_keywords_pkey" PRIMARY KEY("book_id","keyword_id")
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"value_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books_authors" ADD CONSTRAINT "books_authors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books_authors" ADD CONSTRAINT "books_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books_keywords" ADD CONSTRAINT "books_keywords_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books_keywords" ADD CONSTRAINT "books_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_name_normalized_idx" ON "authors" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "authors_name_trgm_idx" ON "authors" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "books_title_normalized_idx" ON "books" USING btree ("title_normalized");--> statement-breakpoint
CREATE INDEX "books_title_trgm_idx" ON "books" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_value_normalized_idx" ON "keywords" USING btree ("value_normalized");--> statement-breakpoint
CREATE INDEX "keywords_value_trgm_idx" ON "keywords" USING gin ("value" gin_trgm_ops);
