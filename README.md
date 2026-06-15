# Kids Discovery Prototype

A Next.js app for discovering kids' books via semantic search.

## Prerequisites

- [Bun](https://bun.sh)
- Postgres with `pgvector` and `pg_trgm` (local or [Supabase](https://supabase.com))

## Local setup

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure environment**

   Copy `.env.sample` to `.env` and fill in the values:

   ```bash
   cp .env.sample .env
   ```

   - `DATABASE_URL` — Postgres connection string. For Supabase, use the **session pooler** string (port 5432) when running migrations from your machine.
   - `OPENAI_API_KEY` — required for embeddings and search.

3. **Set up the database**

   ```bash
   bun run db:migrate
   bun run db:check-vector   # should print "pgvector check passed"
   ```

4. **Seed data** (optional, but needed for search to return results)

   ```bash
   bun run db:seed
   bun run data:generate-embeddings
   ```

5. **Start the dev server**

   ```bash
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Useful commands

| Command | Description |
| --- | --- |
| `bun dev` | Start the development server |
| `bun run build` | Production build |
| `bun run db:generate` | Generate a migration after schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run lint` | Run Biome checks |
