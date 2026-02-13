"use client";

import { useState, useEffect, useRef } from "react";

/**
 * FadeText — Subtle cross-fade animation when text content changes.
 *
 * Used for translated text: when `t()` returns a new value (English → Hindi),
 * the old text fades out briefly, then the new text fades in with a slight
 * upward slide. Total animation: ~400ms.
 *
 * For block-level content, use as="div" or as="p".
 */
export function FadeText({
  text,
  className,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3";
}) {
  const [displayText, setDisplayText] = useState(text);
  const [phase, setPhase] = useState<"visible" | "fading-out" | "fading-in">("visible");
  const prevText = useRef(text);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;

    // Phase 1: fade out
    setPhase("fading-out");

    timerRef.current = setTimeout(() => {
      // Phase 2: swap text + fade in
      setDisplayText(text);
      setPhase("fading-in");

      timerRef.current = setTimeout(() => {
        setPhase("visible");
      }, 350);
    }, 150);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text]);

  const transitionClass =
    phase === "fading-out"
      ? "opacity-0 translate-y-px"
      : phase === "fading-in"
        ? "animate-translate-in"
        : "";

  return (
    <Tag
      className={`transition-opacity duration-150 ${transitionClass} ${className || ""}`}
    >
      {displayText}
    </Tag>
  );
}

/**
 * FadeBlock — Wraps arbitrary React children. When `translationKey` changes
 * (e.g., from English to Hindi), the entire block fades out/in.
 */
export function FadeBlock({
  translationKey,
  children,
  className,
}: {
  translationKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState(children);
  const [phase, setPhase] = useState<"visible" | "fading-out" | "fading-in">("visible");
  const prevKey = useRef(translationKey);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (translationKey === prevKey.current) return;
    prevKey.current = translationKey;

    setPhase("fading-out");

    timerRef.current = setTimeout(() => {
      setDisplayed(children);
      setPhase("fading-in");

      timerRef.current = setTimeout(() => {
        setPhase("visible");
      }, 350);
    }, 150);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [translationKey, children]);

  // Always update displayed content when key hasn't changed (normal re-renders)
  useEffect(() => {
    if (translationKey === prevKey.current && phase === "visible") {
      setDisplayed(children);
    }
  }, [children, translationKey, phase]);

  const transitionClass =
    phase === "fading-out"
      ? "opacity-0 translate-y-px"
      : phase === "fading-in"
        ? "animate-translate-in"
        : "";

  return (
    <div className={`transition-opacity duration-150 ${transitionClass} ${className || ""}`}>
      {displayed}
    </div>
  );
}
