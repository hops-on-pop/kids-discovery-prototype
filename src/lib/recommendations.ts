import { sql } from "@/db";

const MAX_SUGGESTIONS = 12;
const MAX_RECOMMENDATIONS = 12;
const MIN_RECOMMENDATION_SCORE = 0.34;
const MIN_TITLE_FUZZY_SCORE = 0.45;

export type TitleSuggestion = {
  id: number;
  title: string;
  authors: string[];
  coverPath: string | null;
  score: number;
};

export type RecommendationResult = {
  id: number;
  title: string;
  abstract: string;
  coverPath: string | null;
  authors: string[];
  keywords: string[];
  score: number;
};

type TitleSuggestionRow = {
  id: number;
  title: string;
  cover_path: string | null;
  authors: string[] | null;
  score: string | number;
};

type RecommendationRow = {
  id: number;
  title: string;
  abstract: string;
  cover_path: string | null;
  authors: string[] | null;
  keywords: string[] | null;
  score: string | number;
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

export async function resolveBookIdByTitle(title: string) {
  const cleanedTitle = title.replace(/\s+/g, " ").trim();

  if (!cleanedTitle) {
    return null;
  }

  const normalizedTitle = normalize(cleanedTitle);
  const lowerTitle = cleanedTitle.toLowerCase();
  const prefixTitle = `${normalizedTitle}%`;

  const rows = await sql<{ id: number; score: string | number }[]>`
    select
      b.id,
      greatest(
        case when b.title_normalized = ${normalizedTitle} then 1 else 0 end,
        case when b.title_normalized like ${prefixTitle} then 0.95 else 0 end,
        similarity(lower(b.title), ${lowerTitle}),
        word_similarity(lower(b.title), ${lowerTitle})
      ) as score
    from books b
    order by
      case when b.title_normalized = ${normalizedTitle} then 1 else 0 end desc,
      score desc,
      b.title asc
    limit 1
  `;

  const match = rows[0];

  if (!match) {
    return null;
  }

  const score = Number(match.score);
  return score >= MIN_TITLE_FUZZY_SCORE ? match.id : null;
}

export async function getTitleSuggestions(
  query: string,
): Promise<TitleSuggestion[]> {
  const cleanedQuery = query.replace(/\s+/g, " ").trim();

  if (!cleanedQuery) {
    return [];
  }

  const normalizedQuery = normalize(cleanedQuery);
  const lowerQuery = cleanedQuery.toLowerCase();
  const prefixQuery = `${normalizedQuery}%`;

  const rows = (await sql<TitleSuggestionRow[]>`
    with people as (
      select
        ba.book_id,
        array_agg(distinct a.name order by a.name) as authors
      from books_authors ba
      join authors a on a.id = ba.author_id
      group by ba.book_id
    )
    select
      b.id,
      b.title,
      b.cover_path,
      coalesce(p.authors, array[]::text[]) as authors,
      greatest(
        case when b.title_normalized = ${normalizedQuery} then 1 else 0 end,
        case when b.title_normalized like ${prefixQuery} then 0.95 else 0 end,
        similarity(lower(b.title), ${lowerQuery}),
        word_similarity(lower(b.title), ${lowerQuery})
      ) as score
    from books b
    left join people p on p.book_id = b.id
    where
      b.title_normalized like ${prefixQuery}
      or similarity(lower(b.title), ${lowerQuery}) >= ${MIN_TITLE_FUZZY_SCORE}
      or word_similarity(lower(b.title), ${lowerQuery}) >= ${MIN_TITLE_FUZZY_SCORE}
    order by
      case when b.title_normalized = ${normalizedQuery} then 1 else 0 end desc,
      score desc,
      b.title asc
    limit ${MAX_SUGGESTIONS}
  `) as TitleSuggestionRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    coverPath: row.cover_path,
    authors: row.authors ?? [],
    score: Number(row.score),
  }));
}

export async function recommendBooksByTitle(title: string): Promise<{
  sourceBook: { id: number; title: string } | null;
  recommendations: RecommendationResult[];
}> {
  const bookId = await resolveBookIdByTitle(title);

  if (!bookId) {
    return { sourceBook: null, recommendations: [] };
  }

  const sourceBookRows = await sql<{ id: number; title: string }[]>`
    select id, title
    from books
    where id = ${bookId}
    limit 1
  `;
  const sourceBook = sourceBookRows[0] ?? null;

  const fieldRow = await sql<
    { title: string; description: string; keywords: string }[]
  >`
    select
      coalesce(
        (select embedding::text from book_embeddings where book_id = ${bookId} and field_name = 'title'),
        ''
      ) as title,
      coalesce(
        (select embedding::text from book_embeddings where book_id = ${bookId} and field_name = 'description'),
        ''
      ) as description,
      coalesce(
        (select embedding::text from book_embeddings where book_id = ${bookId} and field_name = 'keywords'),
        ''
      ) as keywords
  `;

  const fieldEmbeddings = fieldRow[0];
  if (
    !fieldEmbeddings?.title ||
    !fieldEmbeddings.description ||
    !fieldEmbeddings.keywords
  ) {
    throw new Error("Missing cached embeddings for source book.");
  }

  const recommendations = (await sql<RecommendationRow[]>`
    with field_scores as (
      select
        book_id,
        max(case when field_name = 'description' then 1 - (embedding <=> ${fieldEmbeddings.description}::vector) end) as description_similarity,
        max(case when field_name = 'title' then 1 - (embedding <=> ${fieldEmbeddings.title}::vector) end) as title_similarity,
        max(case when field_name = 'keywords' then 1 - (embedding <=> ${fieldEmbeddings.keywords}::vector) end) as keyword_similarity
      from book_embeddings
      where book_id <> ${bookId}
      group by book_id
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
        (
          coalesce(fs.description_similarity, 0) * 0.6
          + coalesce(fs.title_similarity, 0) * 0.25
          + coalesce(fs.keyword_similarity, 0) * 0.15
        ) as score
      from books b
      join field_scores fs on fs.book_id = b.id
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
      score
    from scored
    where score >= ${MIN_RECOMMENDATION_SCORE}
    order by score desc, title asc
    limit ${MAX_RECOMMENDATIONS}
  `) as RecommendationRow[];

  return {
    sourceBook,
    recommendations: recommendations.map((row) => ({
      id: row.id,
      title: row.title,
      abstract: row.abstract,
      coverPath: row.cover_path,
      authors: row.authors ?? [],
      keywords: row.keywords ?? [],
      score: Number(row.score),
    })),
  };
}

export async function recommendBooksByBookId(bookId: number): Promise<{
  sourceBook: { id: number; title: string } | null;
  recommendations: RecommendationResult[];
}> {
  const rows = await sql<{ id: number; title: string }[]>`
    select id, title
    from books
    where id = ${bookId}
    limit 1
  `;

  const sourceBook = rows[0] ?? null;
  if (!sourceBook) {
    return { sourceBook: null, recommendations: [] };
  }

  const recommendationRows = (await sql<RecommendationRow[]>`
    with field_scores as (
      select
        book_id,
        max(case when field_name = 'description' then 1 - (embedding <=> (select embedding from book_embeddings where book_id = ${bookId} and field_name = 'description')::vector) end) as description_similarity,
        max(case when field_name = 'title' then 1 - (embedding <=> (select embedding from book_embeddings where book_id = ${bookId} and field_name = 'title')::vector) end) as title_similarity,
        max(case when field_name = 'keywords' then 1 - (embedding <=> (select embedding from book_embeddings where book_id = ${bookId} and field_name = 'keywords')::vector) end) as keyword_similarity
      from book_embeddings
      where book_id <> ${bookId}
      group by book_id
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
        (
          coalesce(fs.description_similarity, 0) * 0.6
          + coalesce(fs.title_similarity, 0) * 0.25
          + coalesce(fs.keyword_similarity, 0) * 0.15
        ) as score
      from books b
      join field_scores fs on fs.book_id = b.id
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
      score
    from scored
    where score >= ${MIN_RECOMMENDATION_SCORE}
    order by score desc, title asc
    limit ${MAX_RECOMMENDATIONS}
  `) as RecommendationRow[];

  return {
    sourceBook,
    recommendations: recommendationRows.map((row) => ({
      id: row.id,
      title: row.title,
      abstract: row.abstract,
      coverPath: row.cover_path,
      authors: row.authors ?? [],
      keywords: row.keywords ?? [],
      score: Number(row.score),
    })),
  };
}
