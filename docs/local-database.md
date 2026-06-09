# Local Database Setup

Phase 1 is configured for local PostgreSQL using this connection string:

```txt
postgresql://postgres:postgres@localhost:5432/562-kids-discovery
```

Required environment variables:

- `DATABASE_URL`: PostgreSQL connection string used by Next.js, Drizzle Kit, and import/check scripts.
- `OPENAI_API_KEY`: OpenAI API key used server-side for embedding generation. Leave this unprefixed; do not expose it as `NEXT_PUBLIC_OPENAI_API_KEY`.

No Supabase-specific variables are required for the current local-only setup. If Supabase becomes the hosted target, use its pooled or direct Postgres connection string as `DATABASE_URL`.

Create the local database before running migrations:

```sh
createdb 562-kids-discovery
```

The first migration enables these extensions:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

If `CREATE EXTENSION vector` fails, install pgvector for your local PostgreSQL version first. On macOS with Homebrew PostgreSQL, this is typically:

```sh
brew install pgvector
```

Then rerun:

```sh
bun run db:migrate
```
