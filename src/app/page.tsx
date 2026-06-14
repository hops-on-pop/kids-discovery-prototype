import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-5 py-12 sm:px-8 lg:px-10">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="font-medium text-muted-foreground text-sm">
            Kids Discovery Prototype
          </p>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-6xl">
            Find children&apos;s books from a small local catalog.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Start with search. Recommendations will build on the same book data
            and field-specific embeddings in the next milestone.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/search">
              <SearchIcon data-icon="inline-start" />
              Search books
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/search?query=book%20about%20crayons">
              Try a sample phrase
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
