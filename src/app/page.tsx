import { ArrowRightIcon, SearchIcon, Wand2Icon } from "lucide-react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-5 py-12 sm:px-8 lg:px-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 font-bold text-secondary-foreground text-4xl">
            <span
              aria-hidden
              className="size-9 bg-current mask-[url(/book-sparkle.svg)] mask-center mask-no-repeat mask-contain"
            />
            Book Buddy
          </span>
          <h1 className="font-display text-4xl font-bold text-foreground sm:text-6xl">
            Let&apos;s find your next favorite book!
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            You can hunt for a book with your own words, or tell us a book you
            love and we&apos;ll find more just like it. Pick an option below to
            get started.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Link
            href="/search"
            className="group rounded-3xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full rounded-3xl border-2 border-rainbow-blue/30 bg-rainbow-blue/5 transition-transform group-hover:-translate-y-1 group-hover:border-rainbow-blue/60">
              <CardHeader className="items-center text-center">
                <span className="mb-2 flex size-20 items-center justify-center rounded-full bg-rainbow-blue text-white shadow-md">
                  <SearchIcon className="size-10" />
                </span>
                <CardTitle className="font-display text-2xl">
                  Search for a book
                </CardTitle>
                <CardDescription className="text-base">
                  Type anything you can think of — a funny story, animals,
                  spooky stuff, or a book&apos;s name.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center gap-2 font-bold text-rainbow-blue-dark">
                Start Searching
                <ArrowRightIcon className="size-5 transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>

          <Link
            href="/recommendations"
            className="group rounded-3xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full rounded-3xl border-2 border-rainbow-green/30 bg-rainbow-green/5 transition-transform group-hover:-translate-y-1 group-hover:border-rainbow-green/60">
              <CardHeader className="items-center text-center">
                <span className="mb-2 flex size-20 items-center justify-center rounded-full bg-rainbow-green text-white shadow-md">
                  <Wand2Icon className="size-10" />
                </span>
                <CardTitle className="font-display text-2xl">
                  Find similar books
                </CardTitle>
                <CardDescription className="text-base">
                  Already love a book? Tell us its name and we&apos;ll find
                  others that feel the same.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center gap-2 font-bold text-rainbow-green-dark">
                Start Discovering
                <ArrowRightIcon className="size-5 transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </main>
  )
}
