import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { sql } from "@/db";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_RESULTS = 12;
const MIN_TOTAL_SCORE = 0.22;
const MIN_LEXICAL_SCORE = 0.35;
const DESCRIPTION_WEIGHT = 0.55;
const TITLE_WEIGHT = 0.2;
const KEYWORD_WEIGHT = 0.1;
const LEXICAL_WEIGHT = 0.15;

export type SearchResult = {
  id: number;
  title: string;
  abstract: string;
  coverPath: string | null;
  authors: string[];
  keywords: string[];
  score: number;
};

type SearchRow = {
  id: number;
  title: string;
  abstract: string;
  cover_path: string | null;
  authors: string[] | null;
  keywords: string[] | null;
  total_score: string | number;
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2018\u2019]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

export async function searchBooks(query: string): Promise<SearchResult[]> {
  const cleanedQuery = query.replace(/\s+/g, " ").trim();

  if (!cleanedQuery) {
    return [];
  }

  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: cleanedQuery,
    maxRetries: 2,
  });

  const normalizedQuery = normalize(cleanedQuery);
  const lowerQuery = cleanedQuery.toLowerCase();
  const prefixQuery = `${normalizedQuery}%`;
  const vector = toVectorLiteral(embedding);

  const rows = (await sql<SearchRow[]>`
    with field_scores as (
      select
        book_id,
        max(
          case
            when field_name = 'description'
              then 1 - (embedding <=> ${vector}::vector)
          end
        ) as description_similarity,
        max(
          case
            when field_name = 'title'
              then 1 - (embedding <=> ${vector}::vector)
          end
        ) as title_similarity,
        max(
          case
            when field_name = 'keywords'
              then 1 - (embedding <=> ${vector}::vector)
          end
        ) as keyword_similarity
      from book_embeddings
      group by book_id
    ),
    lexical_scores as (
      select
        b.id as book_id,
        b.title_normalized = ${normalizedQuery} as exact_title,
        coalesce(bool_or(a.name_normalized = ${normalizedQuery}), false) as exact_author,
        coalesce(bool_or(k.value_normalized = ${normalizedQuery}), false) as exact_keyword,
        greatest(
          similarity(lower(b.title), ${lowerQuery}),
          case when b.title_normalized = ${normalizedQuery} then 1 else 0 end,
          case when b.title_normalized like ${prefixQuery} then 0.92 else 0 end,
          coalesce(max(similarity(lower(a.name), ${lowerQuery})), 0),
          coalesce(max(similarity(lower(k.value), ${lowerQuery})), 0)
        ) as lexical_similarity
      from books b
      left join books_authors ba on ba.book_id = b.id
      left join authors a on a.id = ba.author_id
      left join books_keywords bk on bk.book_id = b.id
      left join keywords k on k.id = bk.keyword_id
      group by b.id, b.title, b.title_normalized
    ),
    book_people as (
      select
        ba.book_id,
        array_agg(distinct a.name order by a.name) as authors
      from books_authors ba
      join authors a on a.id = ba.author_id
      group by ba.book_id
    ),
    book_terms as (
      select
        bk.book_id,
        array_agg(distinct k.value order by k.value) as keywords
      from books_keywords bk
      join keywords k on k.id = bk.keyword_id
      group by bk.book_id
    ),
    scored as (
      select
        b.id,
        b.title,
        b.abstract,
        b.cover_path,
        coalesce(bp.authors, array[]::text[]) as authors,
        coalesce(bt.keywords, array[]::text[]) as keywords,
        ls.exact_title,
        ls.exact_author,
        ls.exact_keyword,
        ls.lexical_similarity,
        (
          coalesce(fs.description_similarity, 0) * ${DESCRIPTION_WEIGHT}
          + coalesce(fs.title_similarity, 0) * ${TITLE_WEIGHT}
          + coalesce(fs.keyword_similarity, 0) * ${KEYWORD_WEIGHT}
          + coalesce(ls.lexical_similarity, 0) * ${LEXICAL_WEIGHT}
        ) as total_score
      from books b
      join field_scores fs on fs.book_id = b.id
      join lexical_scores ls on ls.book_id = b.id
      left join book_people bp on bp.book_id = b.id
      left join book_terms bt on bt.book_id = b.id
    )
    select
      id,
      title,
      abstract,
      cover_path,
      authors,
      keywords,
      total_score
    from scored
    where
      total_score >= ${MIN_TOTAL_SCORE}
      or lexical_similarity >= ${MIN_LEXICAL_SCORE}
      or exact_title
      or exact_author
      or exact_keyword
    order by
      exact_title desc,
      exact_author desc,
      exact_keyword desc,
      (lexical_similarity >= ${MIN_LEXICAL_SCORE}) desc,
      total_score desc,
      title asc
    limit ${MAX_RESULTS}
  `) as SearchRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    abstract: row.abstract,
    coverPath: row.cover_path,
    authors: row.authors ?? [],
    keywords: row.keywords ?? [],
    score: Number(row.total_score),
  }));
}
