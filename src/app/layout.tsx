import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kids Discovery Prototype",
  description: "Children's book search and recommendation prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
