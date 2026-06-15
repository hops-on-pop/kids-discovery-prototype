"use client"

import { ArrowLeftIcon, Wand2Icon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useActionState, useEffect, useRef, useState } from "react"
import {
  type RecommendationState,
  recommendationAction,
} from "@/app/recommendations/actions"
import { BookCard } from "@/components/book-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TitleSuggestion = {
  id: number
  title: string
  authors: string[]
  coverPath: string | null
  score: number
}

const initialState: RecommendationState = {
  input: "",
  resolvedTitle: null,
  sourceBookId: null,
  recommendations: [],
  status: "idle",
  message: null,
}

export function RecommendationWorkflow() {
  const [state, formAction, pending] = useActionState(
    recommendationAction,
    initialState,
  )
  const [input, setInput] = useState("")
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<TitleSuggestion | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)
  const skipFetchRef = useRef(false)

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Skip refetching when the input was set by selecting a suggestion.
    if (skipFetchRef.current) {
      skipFetchRef.current = false
      return
    }

    const trimmed = input.replace(/\s+/g, " ").trim()

    if (!trimmed) {
      setSuggestions([])
      setSuggestionsOpen(false)
      setLoadingSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current
      setLoadingSuggestions(true)

      try {
        const response = await fetch(
          `/api/recommendations/titles?q=${encodeURIComponent(trimmed)}`,
        )
        const data = (await response.json()) as {
          suggestions?: TitleSuggestion[]
        }

        if (requestId !== requestIdRef.current) {
          return
        }

        setSuggestions(data.suggestions ?? [])
        setSuggestionsOpen(true)
      } catch {
        if (requestId === requestIdRef.current) {
          setSuggestions([])
          setSuggestionsOpen(false)
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingSuggestions(false)
        }
      }
    }, 180)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [input])

  function submitSearch() {
    formRef.current?.requestSubmit()
  }

  function chooseSuggestion(suggestion: TitleSuggestion) {
    skipFetchRef.current = true
    setInput(suggestion.title)
    setSelectedSuggestion(suggestion)
    setSuggestionsOpen(false)
    // Let the hidden bookId input update before submitting.
    window.setTimeout(submitSearch, 0)
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

        <div className="flex flex-col gap-5 rounded-3xl bg-rainbow-green/10 p-6 sm:p-8">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">
              Loved a book? Let&apos;s find more!
            </h1>
            <p className="max-w-4xl text-lg text-muted-foreground">
              Type the name of a book you like and pick it from the list.
              We&apos;ll find others with the same kind of magic.
            </p>
          </div>

          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col gap-3"
          >
            <Label htmlFor="title" className="font-display text-base">
              What&apos;s a book you love?
            </Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="title"
                name="title"
                type="search"
                placeholder="start typing a book's name…"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value)
                  setSelectedSuggestion(null)
                }}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setSuggestionsOpen(true)
                  }
                }}
                onBlur={() => {
                  setSuggestionsOpen(false)
                }}
                required
                className="h-12 rounded-full bg-card px-5 text-base"
              />

              {suggestionsOpen &&
              (suggestions.length > 0 || loadingSuggestions) ? (
                <div className="absolute z-10 mt-2 w-full rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg">
                  {loadingSuggestions ? (
                    <p className="px-3 py-2 text-muted-foreground text-sm">
                      Searching titles...
                    </p>
                  ) : null}
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                      onPointerDown={(event) => {
                        event.preventDefault()
                        chooseSuggestion(suggestion)
                      }}
                    >
                      <span className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                        {suggestion.coverPath ? (
                          <Image
                            src={suggestion.coverPath}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {suggestion.title}
                        </span>
                        <span className="block truncate text-muted-foreground text-xs">
                          {suggestion.authors.join(", ") || "Unknown author"}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!loadingSuggestions && suggestions.length === 0 ? (
                    <p className="px-3 py-2 text-muted-foreground text-sm">
                      No close title matches yet.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <input
              type="hidden"
              name="bookId"
              value={selectedSuggestion?.id ?? ""}
            />
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-live="polite">
        {pending ? (
          <Alert>
            <Wand2Icon />
            <AlertTitle>Finding books you might love…</AlertTitle>
            <AlertDescription>Hang tight for a second.</AlertDescription>
          </Alert>
        ) : null}

        {!pending && state.message ? (
          <Empty className="border-2">
            <EmptyTitle className="font-display">
              We couldn&apos;t find a match!
            </EmptyTitle>
            <EmptyDescription>{state.message}</EmptyDescription>
          </Empty>
        ) : null}

        {!pending && state.resolvedTitle ? (
          <Alert>
            <Wand2Icon />
            <AlertTitle className="font-display">
              More books like{" "}
              <span className="text-primary">{state.resolvedTitle}</span>
            </AlertTitle>
          </Alert>
        ) : null}

        {!pending && state.recommendations.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {state.recommendations.map((book, index) => (
              <BookCard key={book.id} book={book} index={index} />
            ))}
          </div>
        ) : null}

        {!pending && state.status === "empty" && state.sourceBookId ? (
          <Empty className="border-2">
            <EmptyTitle className="font-display">No matches yet!</EmptyTitle>
            <EmptyDescription>
              We couldn&apos;t find books close enough to this one. Try another
              title you like.
            </EmptyDescription>
          </Empty>
        ) : null}
      </section>
    </main>
  )
}
