"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { CognitiveDepth } from "./cognitive-depth";
import { useTranslation } from "@/lib/i18n-context";
import { FadeText } from "./fade-text";

/**
 * Collapsible panel that shows the model's extended thinking.
 * Streams real Claude reasoning with clean formatting.
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
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const { tDynamic, language } = useTranslation();

  // Auto-collapse thinking panels when switching to a non-English language.
  // The translated summary header still shows; users can re-expand if desired.
  useEffect(() => {
    if (language !== "English") {
      setIsOpen(false);
    }
  }, [language]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && isOpen && isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [excerpt, isOpen, isAtBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setIsAtBottom(nearBottom);
  };

  const agentStyles: Record<string, { border: string; bg: string; accent: string; chevron: string }> = {
    research: {
      border: "border-blue-500/20 dark:border-blue-500/15",
      bg: "bg-blue-50 dark:bg-blue-950/10",
      accent: "text-blue-600 dark:text-blue-400/60",
      chevron: "text-blue-500/60 dark:text-blue-500/40",
    },
    document: {
      border: "border-purple-500/20 dark:border-purple-500/15",
      bg: "bg-purple-50 dark:bg-purple-950/10",
      accent: "text-purple-600 dark:text-purple-400/60",
      chevron: "text-purple-500/60 dark:text-purple-500/40",
    },
    advisory: {
      border: "border-emerald-500/20 dark:border-emerald-500/15",
      bg: "bg-emerald-50 dark:bg-emerald-950/10",
      accent: "text-emerald-600 dark:text-emerald-400/60",
      chevron: "text-emerald-500/60 dark:text-emerald-500/40",
    },
  };

  const styles = agentStyles[agent] || {
    border: "border-foreground/[0.08]",
    bg: "bg-muted dark:bg-card/30",
    accent: "text-muted-foreground",
    chevron: "text-muted-foreground",
  };

  // Translate both summary header and body content
  const translatedSummary = tDynamic(summary || "Reasoning");
  const rawText = excerpt || summary;
  const translatedText = tDynamic(rawText);
  const formatted = useMemo(() => formatThinking(translatedText), [translatedText]);

  return (
    <div className={`my-2.5 rounded-lg border ${styles.border} ${styles.bg} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <svg
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${styles.chevron} ${isOpen ? "rotate-0" : "-rotate-90"}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <FadeText
          text={translatedSummary}
          className={`text-[11px] font-medium uppercase tracking-wider ${styles.accent}`}
        />
        {tokens != null && budget != null && (
          <CognitiveDepth tokens={tokens} budget={budget} />
        )}
      </button>

      {/* Content */}
      {isOpen && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="border-t border-foreground/[0.06] px-5 py-4 text-sm text-foreground/70 leading-[1.8] max-h-72 overflow-y-auto scroll-smooth"
        >
          {formatted}
        </div>
      )}
    </div>
  );
}

/* ─── Meta-commentary stripping ───────────────────────────────────── */

/**
 * Sentences (or sentence fragments) that are model self-talk,
 * not useful to the end user. These are matched ANYWHERE in a line
 * and the matching sentence is removed.
 */
const META_SENTENCE_PATTERNS = [
  // ── JSON / response construction ──
  /\blet me (?:construct|build|create|format|generate|output|write|produce|compile|structure|organize) (?:the |a |this |my )?(?:JSON|response|output|structured|data|object|result)[^.]*\.?\s*/gi,
  /\b(?:I'll |I will |I should |I need to )(?:construct|build|create|format|generate|output|write|produce|compile|structure|organize) (?:the |a |this |my )?(?:JSON|response|output|structured|data|object|result)[^.]*\.?\s*/gi,
  /\b(?:now )?(?:let me |I'll |I will )?(?:organize|structure|format|compile) (?:this|these|the results|my (?:response|findings|analysis))[^.]*\.?\s*/gi,
  /\b(?:Generating|Building|Constructing|Writing|Producing) (?:the )?(?:JSON|response|output|data)[^.]*\.?\s*/gi,

  // ── First-person process narration ("I'm doing...", "Now I'm...", "I'm also...") ──
  /\b(?:Now )?I'm (?:also )?(?:doing|looking at|working through|reviewing|putting together|refining|reconsidering|noticing|tracking|aiming for|checking|counting|noting|pulling|listing|structuring)[^.]*\.?\s*/gi,
  /\b(?:Now )?I'm (?:also )?(?:working|looking|going|moving|thinking)[^.]*\.?\s*/gi,
  /\bNow (?:let me|I'll|I should|I need to|I'm)[^.]*\.?\s*/gi,

  // ── Self-direction ("I should...", "I need to...", "I also need...") ──
  /\bI (?:should|need to|also need to|want to|have to) (?:also )?(?:clarify|check|verify|note|mention|make sure|be aware|add|include|prepare|gather|get)[^.]*\.?\s*/gi,
  /\b(?:I should |I need to )(?:note|verify|double-check|reconsider|be careful about|make sure)[^.]*\.?\s*/gi,

  // ── "Let me..." broad catch ──
  /\blet me (?:note|think about|consider|check|verify|double-check|reconsider|be careful|make sure|clarify|count|pull together|also|refine|restructure|move on|look at)[^.]*\.?\s*/gi,
  /\blet me (?:provide|give) (?:accurate|correct|precise) (?:information|details|data)[^.]*\.?\s*/gi,
  /\blet me (?:structure|organize|format|compile|put together) (?:the |this |my )?(?:response|answer|information|data|results?)[^.]*\.?\s*/gi,

  // ── Hedging / meta-commentary ──
  /\bbut I should (?:note|mention|clarify|also)[^.]*\.?\s*/gi,
  /\bI (?:should|also want to) (?:mention|note|point out|flag|highlight|clarify) (?:that |this )?[^.]*\.?\s*/gi,
  /\b(?:This|That) (?:looks|seems|appears) (?:complete|good|correct|ready|fine)[^.]*\.?\s*/gi,

  // ── Implementation / technical talk ──
  /\b(?:I'll|I will|I should) (?:upload|submit|set|configure|skip|omit|include this|add this|mark this)[^.]*\.?\s*/gi,
  /\bwhich I'll (?:upload|submit|include|add|note|mark)[^.]*\.?\s*/gi,
  /\b(?:so |and )?(?:I'll|I will) (?:skip|omit|leave out|exclude) (?:that|this|those)[^.]*\.?\s*/gi,
  /\b(?:so )?(?:those fields are|that field is|this section is) (?:correctly )?(?:omitted|skipped|empty|not needed|not applicable)[^.]*\.?\s*/gi,

  // ── Entire-line self-talk (matched as full lines) ──
  /^(?:I'm (?:also )?(?:doing|looking|working|reviewing|noting|tracking|aiming|checking))[^.]*\.?\s*$/gi,
  /^(?:Now (?:I'm|let me|I'll|I should|I need))[^.]*\.?\s*$/gi,
  /^(?:This looks complete|I think (?:that's|this is) (?:everything|complete|ready|done))[^.]*\.?\s*$/gi,
];

/**
 * Strip model self-talk from a line. Returns the cleaned line,
 * or empty string if the entire line was meta-commentary.
 */
function stripMetaCommentary(line: string): string {
  let cleaned = line;
  for (const pattern of META_SENTENCE_PATTERNS) {
    // Reset lastIndex since we reuse the regex
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }
  // Clean up residual artifacts: lone dots, dashes, ellipses left after stripping
  cleaned = cleaned.replace(/^[\s.…·\-—–]+$/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}

/* ─── Selective highlighting ──────────────────────────────────────── */

/**
 * Only highlight a very narrow set of critical terms:
 * - Specific visa/travel acronyms (ETIAS, ESTA, ETA)
 * - Currency amounts
 * - Key dates (YYYY-MM-DD or "Month DD, YYYY" format)
 */
const HIGHLIGHT_PATTERN = new RegExp(
  [
    // Specific important acronyms only
    /\b(?:ETIAS|ESTA|ETA|SEVIS)\b/.source,
    // Currency amounts: €7, $50, ¥10,000
    /[€$£¥]\d[\d,.]+/.source,
    // ISO dates: 2026-02-11
    /\b\d{4}-\d{2}-\d{2}\b/.source,
  ].join("|"),
  "g"
);

/**
 * Lightly highlight only critical terms — just bumps brightness.
 */
function highlightTerms(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  HIGHLIGHT_PATTERN.lastIndex = 0;
  while ((match = HIGHLIGHT_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key++} className="text-foreground font-medium">
        {match[0]}
      </span>
    );
    lastIndex = HIGHLIGHT_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ─── Text formatter ──────────────────────────────────────────────── */

function formatThinking(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletGroup: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    elements.push(
      <ul key={key++} className="my-2 ml-1 space-y-1.5">
        {bulletGroup.map((item, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="text-muted-foreground select-none shrink-0 mt-[3px] text-xs">›</span>
            <span className="leading-relaxed">{highlightTerms(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletGroup = [];
  };

  for (const raw of lines) {
    // Strip meta-commentary from each line
    const line = stripMetaCommentary(raw.trim());
    if (!line) {
      flushBullets();
      continue;
    }

    // Bullet line
    if (/^[-•*]\s+/.test(line)) {
      bulletGroup.push(line.replace(/^[-•*]\s+/, ""));
      continue;
    }

    // Numbered item
    if (/^\d+[.)]\s+/.test(line)) {
      bulletGroup.push(line.replace(/^\d+[.)]\s+/, ""));
      continue;
    }

    flushBullets();

    // Status / progress line: starts with — or ─
    if (/^[—─]\s+/.test(line)) {
      elements.push(
        <div
          key={key++}
          className="mt-3 flex items-center gap-2 rounded-md bg-foreground/[0.05] px-3 py-2 text-xs text-muted-foreground font-mono"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse shrink-0" />
          <span>{line.replace(/^[—─]\s+/, "")}</span>
        </div>
      );
      continue;
    }

    // Header/label line: ends with ":" or is ALL CAPS
    if (/:\s*$/.test(line) || (/^[A-Z\s]{4,}$/.test(line) && line.length < 60)) {
      elements.push(
        <p key={key++} className="mt-4 mb-1.5 text-xs font-bold text-foreground/60 tracking-wider uppercase">
          {line.replace(/:$/, "")}
        </p>
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
