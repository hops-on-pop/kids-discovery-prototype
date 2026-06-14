"use server";

import { type SearchResult, searchBooks } from "@/lib/search";

export type SearchState = {
  query: string;
  results: SearchResult[];
  status: "idle" | "success" | "empty" | "error";
  message: string | null;
};

export async function searchAction(
  _previousState: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const query = String(formData.get("query") ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!query) {
    return {
      query,
      results: [],
      status: "error",
      message: "Enter a book idea, title, author, or keyword to search.",
    };
  }

  try {
    const results = await searchBooks(query);

    return {
      query,
      results,
      status: results.length > 0 ? "success" : "empty",
      message:
        results.length > 0
          ? null
          : "No strong matches found in the prototype catalog.",
    };
  } catch (error) {
    console.error("Search failed", error);

    return {
      query,
      results: [],
      status: "error",
      message:
        "Search is unavailable right now. Check the database and OpenAI environment settings.",
    };
  }
}
