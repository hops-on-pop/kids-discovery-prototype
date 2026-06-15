"use server";

import { sql } from "@/db";
import {
  type RecommendationResult,
  recommendBooksByBookId,
  recommendBooksByTitle,
  resolveBookIdByTitle,
} from "@/lib/recommendations";

export type RecommendationState = {
  input: string;
  resolvedTitle: string | null;
  sourceBookId: number | null;
  recommendations: RecommendationResult[];
  status: "idle" | "success" | "empty" | "error";
  message: string | null;
};

export async function recommendationAction(
  _previousState: RecommendationState,
  formData: FormData,
): Promise<RecommendationState> {
  const input = String(formData.get("title") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const rawBookId = String(formData.get("bookId") ?? "").trim();
  const bookId = rawBookId ? Number(rawBookId) : null;

  if (!input) {
    return {
      input,
      resolvedTitle: null,
      sourceBookId: null,
      recommendations: [],
      status: "error",
      message: "Enter a book title to get related recommendations.",
    };
  }

  try {
    const resolved = bookId
      ? await resolveRecommendationBookById(bookId)
      : await resolveRecommendationBook(input);

    if (!resolved) {
      return {
        input,
        resolvedTitle: null,
        sourceBookId: null,
        recommendations: [],
        status: "empty",
        message: "No matching book was found in the prototype catalog.",
      };
    }

    const result = bookId
      ? await recommendBooksByBookId(resolved.id)
      : await recommendBooksByTitle(resolved.title);

    return {
      input,
      resolvedTitle: result.sourceBook?.title ?? resolved.title,
      sourceBookId: result.sourceBook?.id ?? resolved.id,
      recommendations: result.recommendations,
      status: result.recommendations.length > 0 ? "success" : "empty",
      message:
        result.recommendations.length > 0
          ? null
          : "No strong recommendations were found for that title.",
    };
  } catch (error) {
    console.error("Recommendation lookup failed", error);

    return {
      input,
      resolvedTitle: null,
      sourceBookId: null,
      recommendations: [],
      status: "error",
      message:
        "Recommendations are unavailable right now. Check the database and OpenAI environment settings.",
    };
  }
}

async function resolveRecommendationBookById(bookId: number) {
  const rows = await sql<{ id: number; title: string }[]>`
    select id, title
    from books
    where id = ${bookId}
    limit 1
  `;

  return rows[0] ?? null;
}

async function resolveRecommendationBook(input: string) {
  const resolvedId = await resolveBookIdByTitle(input);
  if (!resolvedId) {
    return null;
  }

  return resolveRecommendationBookById(resolvedId);
}
