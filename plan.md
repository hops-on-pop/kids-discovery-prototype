# Kids Discovery Prototype Implementation Roadmap

## Summary

This roadmap defines the Phase 1 implementation plan for the Kids Discovery Prototype. Phase 1 will focus on two core user-facing workflows:

- Natural language search for children's books.
- Related book recommendations based on an entered title.

The prototype will be optimized for desktop display first, with responsive mobile styling where practical. Functionality is the priority, with visual polish added where it supports a simple, age-appropriate, image-forward experience.

Phase 1 will use a small sample catalog dataset sourced from Open Library metadata and locally cleaned keyword/subject data. Field-specific embeddings will be cached locally as JSONL with OpenAI `text-embedding-3-small` before PostgreSQL seeding, so the database can be reset without regenerating unchanged embeddings.

## Phase 1 Scope

Phase 1 includes:

- [ ] A user-facing web prototype built with Next.js v16, Bun, TypeScript, Tailwind v4, and ShadCN UI.
- [ ] PostgreSQL with pgvector for vector search, likely hosted on Supabase.
- [ ] Drizzle ORM for schema management, migrations, and database access.
- [ ] AI SDK integration for OpenAI embedding generation.
- [ ] A repeatable data import script for the sample catalog dataset.
- [ ] Ranked search results for natural language queries.
- [ ] Related recommendations from within the local prototype database only.

Phase 1 data will use existing catalog metadata fields only:

- `title`
- `author`
- `abstract`
- `keywords`

## Milestone 1: Project Foundation

- [x] Review the local Next.js v16 documentation in `node_modules/next/dist/docs/` before implementing app routes, server actions, data fetching, or metadata changes.
- [ ] Install and configure missing project dependencies:
  - [x] Drizzle ORM and Drizzle Kit.
  - [x] PostgreSQL client package.
  - [x] AI SDK and OpenAI provider package.
  - [x] ShadCN UI setup and required Radix dependencies.
  - [x] CSV parsing utilities for import scripts.
  - [ ] Any lightweight fuzzy-search utility if typo tolerance remains feasible within scope.
- [x] Document required environment variables without committing secrets:
  - [x] `DATABASE_URL`
  - [x] `OPENAI_API_KEY`
  - [x] Any Supabase-specific database connection values if needed.
- [x] Create the database foundation:
  - [x] Enable the pgvector extension in PostgreSQL.
  - [x] Enable the `pg_trgm` extension to support trigram-based autocomplete and fuzzy/lexical matching.
  - [x] Define Drizzle schema for books, authors, keywords, and relationships.
  - [x] Add `vector(1536)` embedding storage to match `text-embedding-3-small` output dimensions, declared with Drizzle's pgvector column type.
  - [x] Do not add an ANN index (HNSW/IVFFlat) in Phase 1. With ~50 rows a sequential scan is faster and simpler; revisit indexing only when the catalog grows. Record this as an intentional decision.
  - [x] Create migrations and a repeatable migration workflow.
- [x] Confirm Drizzle's pgvector column type works end to end (define, migrate, insert, query) early, since it gates schema, import, and search work.
- [x] Confirm local development can run with Bun and the current project scripts.

## Milestone 2: Data Import And Embeddings

- [x] Define the Phase 1 sample data source as enriched Open Library JSON plus cleaned subject/keyword data.
- [x] Decision — field-specific embeddings: Phase 1 stores distinct embeddings for title, description, and keywords in a separate `book_embeddings` table. Author matching remains lexical/fuzzy rather than vector-based. This keeps search and recommendation ranking tunable without mixing high-signal descriptions with noisy or overly broad keyword data.
- [x] Create a local embedding-cache script that:
  - [x] Reads `data/children_books_openlibrary.json`.
  - [x] Uses `data/children_books_subjects.json` as the cleaned keyword/subject source.
  - [x] Builds field-specific embedding payloads for title, description/abstract, and keywords.
  - [x] Generates embeddings with OpenAI `text-embedding-3-small`.
  - [x] Writes `data/children_books_embeddings.jsonl`.
  - [x] Reuses unchanged field embeddings by comparing per-field text hashes.
  - [x] Uses conservative batching, retries, and delays to reduce rate-limit risk.
- [x] Run the embedding-cache script to create `data/children_books_embeddings.jsonl`.
- [x] Create a seed/import script that:
  - [x] Reads `data/children_books_embeddings.jsonl`.
  - [x] Normalizes author data into the author table.
  - [x] Normalizes keywords into the keyword table.
  - [x] Creates book records and relationship records.
  - [x] Stores title, description, and keyword embeddings in `book_embeddings`.
- [x] Add a repeatable refresh workflow for prototype development:
  - [x] Clear or replace imported sample data. (`scripts/seed.ts` truncates and reloads.)
  - [x] Re-run the import script from the local JSONL cache. (`bun run db:seed`.)
  - [x] Regenerate only changed embeddings when the source text hash changes. (`bun run data:generate-embeddings` reuses by per-field hash.)
- [x] Include basic import validation:
  - [x] Missing title or abstract handling.
  - [x] Duplicate title handling.
  - [x] Keyword parsing.
  - [x] Missing or invalid cached embedding handling.
  - [ ] Failed embedding request handling. (Handled in the embedding-cache script's retries; the seed script consumes the cache only.)

## Milestone 3: Search Workflow

- [ ] Build a user-facing search experience where users enter natural language phrases such as:
  - "funny alphabet book"
  - "book about crayons"
  - "spooky story with underwear"
  - "books with animals and adventure"
- [ ] Embed the submitted query server-side (server action or route handler) so `OPENAI_API_KEY` is never exposed to the client. Trigger search on submit, not on every keystroke, to avoid unnecessary embedding calls.
- [ ] Return ranked book results only.
- [ ] Do not include match explanations in Phase 1.
- [ ] Prefer a combined search strategy if feasible:
  - [ ] Vector similarity for natural language meaning.
  - [ ] Lexical matching for exact or near-exact title, author, and keyword matches.
- [ ] Document and evaluate the two search approaches during implementation:
  - [ ] Vector-only search is simpler and better for broad semantic queries.
  - [ ] Combined vector and lexical search is more reliable for exact titles, author names, keywords, and partial child-style descriptions.
- [ ] Treat typo tolerance and fuzzy matching as desirable but scope-sensitive:
  - [ ] Include it if a lightweight implementation fits cleanly.
  - [ ] Defer it if it adds too much complexity to the Phase 1 prototype.
- [ ] Define result behavior:
  - [ ] Rank strongest matches first.
  - [ ] Limit results to a manageable count for scanning.
  - [ ] Show enough book metadata for users to identify likely matches.

## Milestone 4: Related Recommendations

- [ ] Build a title-entry recommendation workflow with autocomplete over the local catalog.
  - [ ] As the user types, suggest matching titles from the prototype database (case-insensitive substring plus `pg_trgm` fuzzy matching for typo tolerance against the small, known title set).
  - [ ] The user selects a specific book from the suggestions, which resolves directly to a book record by id. This removes the ambiguity and exact-string fragility of free-text title matching.
  - [ ] If the user submits free text without selecting a suggestion, fall back to the best fuzzy title match; show a clear "no matching book" state when nothing is close enough.
- [ ] Once a book is resolved, use its stored field-specific embeddings to find similar books by weighted vector similarity.
- [ ] Exclude the source book itself from its own recommendation results (it will always be the closest match to its own embedding).
- [ ] Return up to 10 recommendations from the local prototype database only.
- [ ] Do not force low-quality recommendations:
  - [ ] Apply a reasonable similarity threshold.
  - [ ] Return fewer than 10 recommendations when fewer strong matches exist.
  - [ ] Show an empty or low-results state when no useful recommendations are available.
- [ ] Do not include recommendation explanations in Phase 1.
- [ ] Do not use the LLM to suggest books outside the local dataset.

## Milestone 5: UI And Validation

- [ ] Replace the default starter page with the prototype application experience.
- [ ] Provide clear, separate user flows for:
  - [ ] Search.
  - [ ] Related recommendations.
- [ ] Design desktop-first layouts with responsive mobile behavior where practical.
- [ ] Keep the interface simple and child-friendly without over-investing in visual polish for Phase 1.
- [ ] Use ShadCN UI components where they help establish consistent controls and accessible defaults.
- [ ] Include basic loading, empty, and error states for both workflows.
- [ ] Validate the prototype with focused checks:
  - [ ] The import script loads the sample dataset.
  - [ ] Embeddings are generated, cached locally, and stored.
  - [ ] Search returns ranked results.
  - [ ] Title autocomplete suggests matching books and resolves a selection to a single book.
  - [ ] Recommendation results are capped at 10 and exclude the source book.
  - [ ] Low-similarity recommendations are filtered out.
  - [ ] Desktop and mobile layouts remain usable.
  - [ ] Bun scripts, Biome checks, and Next.js build pass.

## Future Phases

Future phases should expand discovery capabilities after the Phase 1 workflows are working reliably.

Candidate future work includes:

- [ ] Expanded catalog metadata:
  - [ ] format
  - [ ] language
  - [ ] age recommendation
  - [ ] genre
  - [ ] publication date ranges
  - [ ] classic characters
  - [ ] themes
  - [ ] tones
  - [ ] character traits
  - [ ] series data
  - [ ] similar author styles
- [ ] Visual discovery of genres, themes, characters, and formats.
- [ ] Multimodal search using cover images or other visual book data.
- [ ] Richer recommendation explanations, such as similar tone, humor, theme, or author style.
- [ ] Broader catalog coverage beyond the sample prototype dataset.
- [ ] More complete child-centered visual design.
- [ ] Kiosk-specific interface adjustments if the touchscreen use case is prioritized.
- [ ] Evaluation of LLM usage once the recommendation and search workflows have stable data foundations.

## Out Of Scope For Phase 1

Phase 1 will not include:

- Full LAPL or production catalog integration.
- Full inclusion of the library system's children's collection.
- Image embeddings.
- Multimodal image and text search.
- Complex faceted metadata search.
- AI-generated recommendations outside the prototype database.
- Recommendation explanations.
- Search result explanations.
- Final LLM model selection.
- Final production database hosting decision beyond likely Supabase.
- Kiosk-specific UI implementation.

## Open Technical Considerations

### Search Strategy

The implementation should compare vector-only search against a combined strategy.

Vector-only search is attractive because it is simpler and aligns directly with the natural language discovery goal. It may work well for descriptive queries, emotional associations, and broad story concepts.

Combined search is likely more useful for the prototype because children, caregivers, and staff may still enter recognizable titles, author names, or keywords. A combined strategy can preserve semantic discovery while improving exact-match reliability.

### Fuzzy Matching

Typo tolerance is desirable for child-facing search, but it should not block the Phase 1 prototype. If it can be added with a lightweight lexical or trigram-based approach, include it. If it complicates ranking or database setup too much, defer it to a later phase.

### Database Hosting

Supabase is the likely database hosting platform because it supports PostgreSQL and pgvector. The plan should still allow local PostgreSQL development where useful for setup, migrations, and import testing.

### LLM Usage

The Phase 1 prototype primarily depends on embeddings. The LLM model can remain TBD because the AI SDK supports changing model providers and models later. LLM-generated recommendations should remain out of scope for Phase 1.

## Assumptions

- OpenAI credentials will be supplied by the user in `.env`.
- `text-embedding-3-small` is fixed for Phase 1 embeddings.
- Supabase is the likely hosted database target.
- Local development may use a local PostgreSQL database if it simplifies development.
- The sample dataset will contain roughly 50 books but may vary.
- The sample dataset will use existing catalog metadata rather than newly created custom metadata.
- Phase 1 is user-facing, desktop-first, and functionality-first.
