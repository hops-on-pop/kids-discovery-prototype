import type { Metadata } from "next"
import { Fredoka, Nunito } from "next/font/google"
import "./globals.css"

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  weight: ["400", "500", "600", "700"],
})

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
})

export const metadata: Metadata = {
  title: "Book Detective — Find Your Next Story",
  description: "A fun way for kids to discover and find children's books.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${fredoka.variable} ${nunito.variable}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
