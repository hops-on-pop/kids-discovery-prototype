import { NextResponse } from "next/server";
import { getTitleSuggestions } from "@/lib/recommendations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  const suggestions = await getTitleSuggestions(query);

  return NextResponse.json({ suggestions });
}
