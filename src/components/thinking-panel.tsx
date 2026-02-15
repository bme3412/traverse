"use client";

import { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n-context";
import { FadeText } from "./fade-text";

/**
 * Research narrative panel — shows the model's thinking process
 * as an always-visible, well-formatted story of discovery.
 */
export function ThinkingPanel({
  agent,
  summary,
  excerpt,
  tokens,
  budget,
}: {
  agent: string;
  summary: string;
  excerpt?: string;
  tokens?: number;
  budget?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const { tDynamic } = useTranslation();

  useEffect(() => {
    const el = scrollRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [excerpt]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  };

  // Translate body content
  const rawText = excerpt || summary;
  const translatedText = tDynamic(rawText);
  const formatted = useMemo(() => formatThinking(translatedText), [translatedText]);

  const translatedSummary = tDynamic(summary || "Researching");

  // Use a "document" agent style for non-research agents
  const isResearch = agent === "research";

  return (
    <div className={`my-2 rounded-lg border overflow-hidden ${
      isResearch
        ? "border-border/60 bg-card/50"
        : "border-purple-500/15 bg-purple-50 dark:bg-purple-950/10"
    }`}>
      {/* Subtle header label */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/30">
        <div className={`w-1.5 h-1.5 rounded-full ${
          translatedSummary.toLowerCase().includes("complete") || translatedSummary.toLowerCase().includes("done") || translatedSummary.toLowerCase().includes("ready")
            ? "bg-emerald-500"
            : "bg-blue-500 animate-pulse"
        }`} />
        <FadeText
          text={translatedSummary}
          className="text-[11px] font-medium text-muted-foreground tracking-wide"
        />
      </div>

      {/* Content — always visible, scrollable */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="px-5 py-4 text-sm text-foreground/85 leading-[1.8] max-h-[28rem] overflow-y-auto scroll-smooth"
      >
        {formatted}
      </div>
    </div>
  );
}

/* ─── Meta-commentary stripping ───────────────────────────────────── */

const META_SENTENCE_PATTERNS = [
  /\blet me (?:construct|build|create|format|generate|output|write|produce|compile|structure|organize) (?:the |a |this |my )?(?:JSON|response|output|structured|data|object|result)[^.]*\.?\s*/gi,
  /\b(?:I'll |I will |I should |I need to )(?:construct|build|create|format|generate|output|write|produce|compile|structure|organize) (?:the |a |this |my )?(?:JSON|response|output|structured|data|object|result)[^.]*\.?\s*/gi,
  /\b(?:now )?(?:let me |I'll |I will )?(?:organize|structure|format|compile) (?:this|these|the results|my (?:response|findings|analysis))[^.]*\.?\s*/gi,
  /\b(?:Generating|Building|Constructing|Writing|Producing) (?:the )?(?:JSON|response|output|data)[^.]*\.?\s*/gi,
  /\b(?:Now )?I'm (?:also )?(?:doing|looking at|working through|reviewing|putting together|refining|reconsidering|noticing|tracking|aiming for|checking|counting|noting|pulling|listing|structuring)[^.]*\.?\s*/gi,
  /\b(?:Now )?I'm (?:also )?(?:working|looking|going|moving|thinking)[^.]*\.?\s*/gi,
  /\bNow (?:let me|I'll|I should|I need|I'm)[^.]*\.?\s*/gi,
  /\bI (?:should|need to|also need to|want to|have to) (?:also )?(?:clarify|check|verify|note|mention|make sure|be aware|add|include|prepare|gather|get)[^.]*\.?\s*/gi,
  /\blet me (?:note|think about|consider|check|verify|double-check|reconsider|be careful|make sure|clarify|count|pull together|also|refine|restructure|move on|look at)[^.]*\.?\s*/gi,
  /\blet me (?:provide|give) (?:accurate|correct|precise) (?:information|details|data)[^.]*\.?\s*/gi,
  /\blet me (?:structure|organize|format|compile|put together) (?:the |this |my )?(?:response|answer|information|data|results?)[^.]*\.?\s*/gi,
  /\bbut I should (?:note|mention|clarify|also)[^.]*\.?\s*/gi,
  /\bI (?:should|also want to) (?:mention|note|point out|flag|highlight|clarify) (?:that |this )?[^.]*\.?\s*/gi,
  /\b(?:This|That) (?:looks|seems|appears) (?:complete|good|correct|ready|fine)[^.]*\.?\s*/gi,
  /\b(?:I'll|I will|I should) (?:upload|submit|set|configure|skip|omit|include this|add this|mark this)[^.]*\.?\s*/gi,
  /\bwhich I'll (?:upload|submit|include|add|note|mark)[^.]*\.?\s*/gi,
  /\b(?:so |and )?(?:I'll|I will) (?:skip|omit|leave out|exclude) (?:that|this|those)[^.]*\.?\s*/gi,
  /\b(?:so )?(?:those fields are|that field is|this section is) (?:correctly )?(?:omitted|skipped|empty|not needed|not applicable)[^.]*\.?\s*/gi,
  /^(?:I'm (?:also )?(?:doing|looking|working|reviewing|noting|tracking|aiming|checking))[^.]*\.?\s*$/gi,
  /^(?:Now (?:I'm|let me|I'll|I should|I need))[^.]*\.?\s*$/gi,
  /^(?:This looks complete|I think (?:that's|this is) (?:everything|complete|ready|done))[^.]*\.?\s*$/gi,
];

function stripMetaCommentary(line: string): string {
  let cleaned = line;
  for (const pattern of META_SENTENCE_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/^[\s.…·\-—–]+$/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}

/* ─── Semantic highlighting ───────────────────────────────────────── */

/** Markdown-style link: [label](url) */
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Highlight rules — order matters (first match wins per character).
 * Each rule maps a regex to a Tailwind class string.
 * Applied AFTER markdown links have been extracted.
 */
const HIGHLIGHT_RULES: Array<{ pattern: RegExp; className: string }> = [
  // Money / fees — green tones
  // Handles ranges like €45-50/day, standalone like €80, with parenthetical like €80 (≈₹7,200), currency-prefixed like EUR 675+
  { pattern: /[€$£¥₹][,.\d]+(?:[-–][,.\d]+)?(?:\/\w+)?(?:\s*\([^)]+\))?/g, className: "text-emerald-600 dark:text-emerald-400 font-semibold" },
  { pattern: /(?:EUR|USD|GBP|INR|JPY)\s*[\d,.]+\+?/g, className: "text-emerald-600 dark:text-emerald-400 font-semibold" },
  // ISO dates
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/g, className: "text-blue-600 dark:text-blue-400 font-medium" },
  // Time durations & processing windows — blue tones
  { pattern: /\b\d+[-–]\d+\s+(?:working\s+)?days?\b/g, className: "text-blue-600 dark:text-blue-400 font-medium" },
  { pattern: /\b\d+\s+(?:working\s+)?days?\b/g, className: "text-blue-600 dark:text-blue-400 font-medium" },
  { pattern: /\b\d+\s+months?\b/g, className: "text-blue-600 dark:text-blue-400 font-medium" },
  { pattern: /\b\d+-day\b/g, className: "text-blue-600 dark:text-blue-400 font-medium" },
  // Full visa type names — match as one bold unit (e.g., "Schengen Business Visa (Type C)")
  { pattern: /\bSchengen\s+(?:\w+\s+)*Visa\s*\(Type\s+[A-D]\)/g, className: "text-foreground font-semibold" },
  { pattern: /\bSchengen\s+(?:\w+\s+)*Visa\b/g, className: "text-foreground font-semibold" },
  // Key acronyms / program names
  { pattern: /\b(?:ETIAS|ESTA|ETA|SEVIS)\b/g, className: "text-foreground font-semibold" },
  // Standalone "VFS Global" (when not already inside a link)
  { pattern: /\bVFS\s+Global\b/g, className: "text-foreground font-semibold" },
  // Standalone Schengen / Type references not already caught above
  { pattern: /\bSchengen\b/g, className: "text-foreground font-semibold" },
];

type HighlightSpan = {
  start: number;
  end: number;
  className?: string;
  // For link spans
  isLink?: boolean;
  label?: string;
  url?: string;
};

/**
 * Parse text into highlighted React nodes.
 * Handles markdown links [label](url) and semantic highlight rules.
 */
function highlightTerms(text: string): React.ReactNode[] {
  const spans: HighlightSpan[] = [];

  // 1. Extract markdown links first — they take priority
  LINK_PATTERN.lastIndex = 0;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = LINK_PATTERN.exec(text)) !== null) {
    spans.push({
      start: linkMatch.index,
      end: linkMatch.index + linkMatch[0].length,
      isLink: true,
      label: linkMatch[1],
      url: linkMatch[2],
    });
  }

  // 2. Apply highlight rules to remaining (non-link) regions
  for (const rule of HIGHLIGHT_RULES) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = spans.some(s => start < s.end && end > s.start);
      if (!overlaps) {
        spans.push({ start, end, className: rule.className });
      }
    }
  }

  if (spans.length === 0) return [text];

  spans.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const span of spans) {
    if (span.start > lastIndex) {
      parts.push(text.slice(lastIndex, span.start));
    }
    if (span.isLink && span.label && span.url) {
      parts.push(
        <a
          key={key++}
          href={span.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 font-medium underline underline-offset-2 decoration-blue-400/40 hover:decoration-blue-500 transition-colors"
        >
          {span.label}
        </a>
      );
    } else {
      parts.push(
        <span key={key++} className={span.className}>
          {text.slice(span.start, span.end)}
        </span>
      );
    }
    lastIndex = span.end;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Format a bullet item, splitting on " — " to give the document/item name
 * a distinct visual weight from its description.
 */
function formatBulletContent(text: string, isWarning: boolean): React.ReactNode {
  const dashIndex = text.indexOf(" — ");
  if (dashIndex === -1 || isWarning) {
    return <span className={isWarning ? "text-foreground/90" : ""}>{highlightTerms(text)}</span>;
  }
  const name = text.slice(0, dashIndex);
  const desc = text.slice(dashIndex + 3);
  return (
    <span>
      <span className="text-foreground font-medium">{name}</span>
      <span className="text-muted-foreground"> — {highlightTerms(desc)}</span>
    </span>
  );
}

/* ─── Text formatter ──────────────────────────────────────────────── */

function formatThinking(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletGroup: { text: string; isWarning: boolean }[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    elements.push(
      <ul key={key++} className="my-2.5 ml-0.5 space-y-2">
        {bulletGroup.map((item, i) => (
          <li key={i} className="flex gap-2.5">
            <span className={`select-none shrink-0 mt-[3px] text-xs ${
              item.isWarning ? "text-amber-500" : "text-muted-foreground/40"
            }`}>
              {item.isWarning ? "⚠" : "•"}
            </span>
            <span className="leading-relaxed">
              {formatBulletContent(item.text, item.isWarning)}
            </span>
          </li>
        ))}
      </ul>
    );
    bulletGroup = [];
  };

  for (const raw of lines) {
    const line = stripMetaCommentary(raw.trim());
    if (!line) {
      flushBullets();
      continue;
    }

    // Section header: § SECTION NAME
    if (/^§\s+/.test(line)) {
      flushBullets();
      const sectionName = line.replace(/^§\s+/, "");
      const isComplete = /^(?:DONE|READY)$/i.test(sectionName);
      elements.push(
        <div key={key++} className={`mt-5 mb-2 flex items-center gap-2.5`}>
          <span className={`text-xs font-semibold tracking-wider uppercase ${
            isComplete
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground/50"
          }`}>
            {sectionName}
          </span>
          <span className="flex-1 h-px bg-border/60" />
        </div>
      );
      continue;
    }

    // Warning bullet: ⚠ ...
    if (/^⚠\s*/.test(line)) {
      bulletGroup.push({ text: line.replace(/^⚠\s*/, ""), isWarning: true });
      continue;
    }

    // Standard bullet
    if (/^[-•*]\s+/.test(line)) {
      bulletGroup.push({ text: line.replace(/^[-•*]\s+/, ""), isWarning: false });
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      bulletGroup.push({ text: line.replace(/^\d+[.)]\s+/, ""), isWarning: false });
      continue;
    }

    flushBullets();

    // Status / progress line: starts with — or ─
    if (/^[—─]\s+/.test(line)) {
      elements.push(
        <div key={key++} className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400/60 animate-pulse shrink-0" />
          <span>{line.replace(/^[—─]\s+/, "")}</span>
        </div>
      );
      continue;
    }

    // Intro / lead-in line: ends with ":" (e.g., "Here's everything required for your application:")
    if (/:\s*$/.test(line) && line.length < 100) {
      elements.push(
        <p key={key++} className="mt-2 mb-1 text-sm text-muted-foreground italic">
          {highlightTerms(line)}
        </p>
      );
      continue;
    }

    // Traverse service callout — highlight lines mentioning Traverse can help
    if (/Traverse can help/i.test(line)) {
      elements.push(
        <div key={key++} className="my-2.5 flex items-start gap-2.5 rounded-md border border-blue-500/20 bg-blue-500/5 px-3.5 py-2.5 text-sm">
          <span className="shrink-0 mt-0.5 text-blue-500">✦</span>
          <span className="text-foreground/90 leading-relaxed">{highlightTerms(line)}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="my-1.5 leading-relaxed">
        {highlightTerms(line)}
      </p>
    );
  }

  flushBullets();
  return <>{elements}</>;
}
