import Image from "next/image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type BookCardData = {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  keywords: string[];
  coverPath: string | null;
};

const rainbow = [
  "rainbow-red",
  "rainbow-orange",
  "rainbow-green",
  "rainbow-blue",
  "rainbow-purple",
  "rainbow-pink",
] as const;

const accentBorder: Record<(typeof rainbow)[number], string> = {
  "rainbow-red": "border-rainbow-red/30",
  "rainbow-orange": "border-rainbow-orange/30",
  "rainbow-green": "border-rainbow-green/30",
  "rainbow-blue": "border-rainbow-blue/30",
  "rainbow-purple": "border-rainbow-purple/30",
  "rainbow-pink": "border-rainbow-pink/30",
};

const badgeTint: Record<(typeof rainbow)[number], string> = {
  "rainbow-red": "bg-rainbow-red/15 text-rainbow-red",
  "rainbow-orange": "bg-rainbow-orange/15 text-rainbow-orange",
  "rainbow-green": "bg-rainbow-green/15 text-rainbow-green",
  "rainbow-blue": "bg-rainbow-blue/15 text-rainbow-blue",
  "rainbow-purple": "bg-rainbow-purple/15 text-rainbow-purple",
  "rainbow-pink": "bg-rainbow-pink/15 text-rainbow-pink",
};

type BookCardProps = {
  book: BookCardData;
  index?: number;
};

export function BookCard({ book, index = 0 }: BookCardProps) {
  const color = rainbow[index % rainbow.length];

  return (
    <Card
      className={cn(
        "gap-4 overflow-hidden rounded-2xl border-2 py-4",
        accentBorder[color],
      )}
    >
      <div className="flex gap-4 px-4">
        <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-md bg-muted">
          {book.coverPath ? (
            <Image
              src={book.coverPath}
              alt=""
              fill
              sizes="112px"
              className="object-contain"
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-lg font-semibold leading-snug">
            {book.title}
          </h2>
          <p className="text-muted-foreground text-sm">
            {book.authors.join(", ") || "Unknown author"}
          </p>
          {book.keywords.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {book.keywords.slice(0, 5).map((keyword) => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className={cn("border-transparent", badgeTint[color])}
                >
                  {keyword}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {book.abstract ? (
        <Accordion type="single" collapsible className="px-4">
          <AccordionItem value="about" className="border-b-0">
            <AccordionTrigger className="py-2 font-display text-base">
              What&apos;s it about?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed">
              {book.abstract}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </Card>
  );
}
