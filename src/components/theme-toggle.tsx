"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Theme Toggle — switches between "Blueberry & Ink" (light) and
 * "Diplomatic Navy" (dark) by flipping the data-theme attribute
 * on <html>. Persists choice to localStorage.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Read the initial theme from the DOM (set by the anti-flash
  // inline script in layout.tsx) so we stay in sync.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  // Render nothing until mounted to avoid hydration mismatch
  // (the icon depends on client-side state).
  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="fixed bottom-5 right-5 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-md hover:bg-secondary transition-colors"
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
