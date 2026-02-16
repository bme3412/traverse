import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Traverse — Every document. Every detail. Every language.",
  description:
    "Three AI agents systematically traverse your entire visa application — researching requirements, reading every document, and telling you exactly what to fix. No immigration lawyer needed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: set data-theme before first paint so the page
            never briefly renders in the wrong colour scheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t||'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased min-h-screen bg-background text-foreground font-sans`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-sm">
              <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-emerald-500 text-white text-sm font-bold shadow-sm">
                    T
                  </div>
                  <span className="text-lg font-semibold tracking-tight">
                    Traverse
                  </span>
                  <span className="hidden sm:inline text-xs border-l border-border/60 pl-2.5 ml-0.5">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Every document</span>
                    <span className="text-muted-foreground/40 mx-1">&middot;</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">Every detail</span>
                    <span className="text-muted-foreground/40 mx-1">&middot;</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Every language</span>
                  </span>
                </div>
                <div className="ml-auto text-xs text-muted-foreground">
                  Built with Claude Opus 4.6
                </div>
              </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>

            {/* Privacy footer */}
            <footer className="border-t border-border/60 py-4">
              <div className="mx-auto max-w-5xl px-6 text-center text-xs text-muted-foreground">
                Your documents are analyzed in-memory and never stored. No
                accounts. No tracking. Open source.
              </div>
            </footer>
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
