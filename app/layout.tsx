import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turnbound Forge",
  description: "Turnbound build planner prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="relative min-h-screen bg-[radial-gradient(circle_at_20%_15%,rgba(251,146,60,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.08),transparent_36%),linear-gradient(180deg,#0b0f18_0%,#070a12_100%)]">
          <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6">
              <Link
                href="/planner"
                className="text-lg font-semibold tracking-tight text-zinc-100 transition hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                Turnbound Forge
              </Link>
              <nav className="flex items-center gap-2">
                <Link
                  href="/planner"
                  className="rounded-md border border-zinc-700/80 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/70 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  Planner
                </Link>
                <Link
                  href="/items"
                  className="rounded-md border border-zinc-700/80 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/70 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  Items
                </Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
