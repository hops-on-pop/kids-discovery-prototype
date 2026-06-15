"use client"

import { ArrowLeftIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { useActionState, useRef } from "react"
import type { SearchState } from "@/app/search/actions"
import { searchAction } from "@/app/search/actions"
import { BookCard } from "@/components/book-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const examples = [
  "a funny alphabet book",
  "a book about crayons",
  "a spooky story with underwear",
  "animals going on an adventure",
]

type SearchWorkflowProps = {
  initialQuery?: string
}

export function SearchWorkflow({ initialQuery = "" }: SearchWorkflowProps) {
  const initialState: SearchState = {
    query: initialQuery,
    results: [],
    status: "idle",
    message: null,
  }
  const [state, formAction, pending] = useActionState(searchAction, {
    ...initialState,
  })
  const formRef = useRef<HTMLFormElement>(null)
  const queryRef = useRef<HTMLInputElement>(null)

  function searchExample(example: string) {
    if (queryRef.current) {
      queryRef.current.value = example
    }
    formRef.current?.requestSubmit()
  }

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
      <section className="flex flex-col gap-5">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link href="/">
            <ArrowLeftIcon data-icon="inline-start" />
            Start Over
          </Link>
        </Button>

        <div className="flex flex-col gap-5 rounded-3xl bg-rainbow-blue/5 p-6 sm:p-8">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">
              What kind of book are you looking for?
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Use your own words! Try a story idea, a topic you like, or even a
              book&apos;s name.
            </p>
          </div>

          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col gap-3"
          >
            <Label htmlFor="query" className="font-display text-base">
              Tell us what you want to read about
            </Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                ref={queryRef}
                id="query"
                name="query"
                type="search"
                placeholder="like… a dragon who loves to bake"
                defaultValue={state.query}
                required
                className="h-12 rounded-full bg-card px-5 text-base"
              />
              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="rounded-full"
                variant="rainbow-blue"
              >
                <SearchIcon data-icon="inline-start" />
                {pending ? "Looking…" : "Find books"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-muted-foreground text-sm">
                Need ideas?
              </span>
              {examples.map((example) => (
                <button
                  className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  key={example}
                  type="button"
                  onClick={() => searchExample(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-live="polite">
        {pending ? (
          <Alert>
            <SearchIcon />
            <AlertTitle>Looking through the bookshelf…</AlertTitle>
            <AlertDescription>This will only take a moment.</AlertDescription>
          </Alert>
        ) : null}

        {!pending && state.message ? (
          <Empty className="border-2">
            <EmptyTitle className="font-display">Hmm, no books yet!</EmptyTitle>
            <EmptyDescription>{state.message}</EmptyDescription>
          </Empty>
        ) : null}

        {!pending && state.results.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {state.results.map((book, index) => (
              <BookCard key={book.id} book={book} index={index} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
