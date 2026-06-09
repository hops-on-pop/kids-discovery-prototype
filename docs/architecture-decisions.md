# Architecture Decisions

## Phase 1 Vector Indexing

Phase 1 intentionally does not add an ANN index such as HNSW or IVFFlat for book embeddings.

The prototype catalog is expected to contain roughly 50 books, so a sequential scan over `vector(1536)` embeddings is simpler and fast enough. This keeps the local setup and migration workflow small while the search and recommendation ranking behavior is still being validated.

Revisit vector indexing when the catalog grows beyond the sample dataset or when query latency becomes measurable during development.
