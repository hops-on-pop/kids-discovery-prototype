# Search Strategy Notes

Milestone 3 compares two practical approaches for the Phase 1 prototype.

## Vector-only search

Vector-only search is the simplest implementation: embed the user query, compare
it with stored book embeddings, and rank by similarity. This is strongest for
broad discovery phrases such as "books with animals and adventure" because it
does not depend on exact words appearing in the catalog metadata.

The tradeoff is that exact titles, author names, and short keyword searches can
rank less reliably because semantic similarity is not the same as identifier
matching.

## Combined vector and lexical search

The implemented search uses field-specific vector scores plus a lexical signal.
The current ranking weights are:

- Description vector: 55%.
- Title vector: 20%.
- Keyword vector: 10%.
- Lexical title, author, and keyword signal: 15%.

Exact title, exact author, and exact keyword matches are ordered ahead of broad
semantic matches so known-item searches remain predictable. PostgreSQL trigram
similarity provides lightweight typo-tolerant matching without adding another
dependency. Strong trigram matches are also ordered ahead of lower-lexical broad
semantic matches to improve short keyword searches.

The result cap is 12 books. The initial minimum total score is 0.22, with
lexical matches allowed through at 0.35 so recognizable title, author, and
keyword searches are not filtered out too aggressively.
