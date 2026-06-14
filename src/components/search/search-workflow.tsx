"use client";

import { SearchIcon } from "lucide-react";
import Image from "next/image";
import { useActionState } from "react";
import type { SearchState } from "@/app/search/actions";
import { searchAction } from "@/app/search/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const examples = [
  "funny alphabet book",
  "book about crayons",
  "spooky story with underwear",
  "books with animals and adventure",
];

type SearchWorkflowProps = {
  initialQuery?: string;
};

export function SearchWorkflow({ initialQuery = "" }: SearchWorkflowProps) {
  const initialState: SearchState = {
    query: initialQuery,
    results: [],
    status: "idle",
    message: null,
  };
  const [state, formAction, pending] = useActionState(searchAction, {
    ...initialState,
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-5">
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="font-medium text-muted-foreground text-sm">
            Kids Discovery Prototype
          </p>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            Search for children&apos;s books
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Try a title, author, keyword, or natural language idea from the
            local sample catalog.
          </p>
        </div>

        <form action={formAction} className="flex max-w-3xl flex-col gap-3">
          <Label htmlFor="query">Search phrase</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="query"
              name="query"
              type="search"
              placeholder="book about crayons"
              defaultValue={state.query}
              required
              className="h-12 text-base"
            />
            <Button type="submit" size="lg" disabled={pending}>
              <SearchIcon data-icon="inline-start" />
              {pending ? "Searching" : "Search"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                className="rounded-md bg-secondary px-3 py-1.5 text-secondary-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                key={example}
                name="query"
                type="submit"
                value={example}
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4" aria-live="polite">
        {pending ? (
          <div className="rounded-lg border bg-card p-6 text-card-foreground">
            Searching the prototype catalog...
          </div>
        ) : null}

        {!pending && state.message ? (
          <div className="rounded-lg border bg-card p-6 text-card-foreground">
            {state.message}
          </div>
        ) : null}

        {!pending && state.results.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.results.map((book) => (
              <article
                className="grid min-h-64 grid-cols-[6rem_1fr] gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-xs"
                key={book.id}
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted">
                  {book.coverPath ? (
                    <Image
                      src={book.coverPath}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold leading-snug">
                      {book.title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {book.authors.join(", ") || "Unknown author"}
                    </p>
                  </div>
                  <p className="line-clamp-4 text-sm">{book.abstract}</p>
                  {book.keywords.length > 0 ? (
                    <p className="line-clamp-2 text-muted-foreground text-xs">
                      {book.keywords.slice(0, 5).join(", ")}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
