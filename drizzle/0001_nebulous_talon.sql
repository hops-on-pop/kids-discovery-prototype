CREATE TYPE "public"."book_embedding_field" AS ENUM('title', 'description', 'keywords');--> statement-breakpoint
CREATE TABLE "book_embeddings" (
	"book_id" integer NOT NULL,
	"field_name" "book_embedding_field" NOT NULL,
	"text" text NOT NULL,
	"text_hash" text NOT NULL,
	"model" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_embeddings_pkey" PRIMARY KEY("book_id","field_name")
);
--> statement-breakpoint
ALTER TABLE "book_embeddings" ADD CONSTRAINT "book_embeddings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_embeddings_field_name_idx" ON "book_embeddings" USING btree ("field_name");--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "embedding";