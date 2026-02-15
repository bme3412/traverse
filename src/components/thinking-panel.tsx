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
          translatedSummary.toLowerCase().includes("complete") || translatedSummary.toLowerCase().includes("done")
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
        className="px-5 py-4 text-[13px] text-foreground/80 leading-[1.75] max-h-[28rem] overflow-y-auto scroll-smooth"
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

/* ─── Selective highlighting ──────────────────────────────────────── */

const HIGHLIGHT_PATTERN = new RegExp(
  [
    /\b(?:ETIAS|ESTA|ETA|SEVIS)\b/.source,
    /[€$£¥]\d[\d,.]+/.source,
    /\b\d{4}-\d{2}-\d{2}\b/.source,
  ].join("|"),
  "g"
);

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
  let bulletGroup: { text: string; isWarning: boolean }[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    elements.push(
      <ul key={key++} className="my-2 ml-0.5 space-y-1">
        {bulletGroup.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className={`select-none shrink-0 mt-[2px] text-xs ${
              item.isWarning ? "text-amber-500" : "text-muted-foreground/50"
            }`}>
              {item.isWarning ? "⚠" : "•"}
            </span>
            <span className={`leading-relaxed ${item.isWarning ? "text-foreground/90" : ""}`}>
              {highlightTerms(item.text)}
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
      const isDone = /^DONE$/i.test(sectionName);
      elements.push(
        <div key={key++} className={`mt-4 mb-1.5 flex items-center gap-2 ${isDone ? "mt-5" : ""}`}>
          <span className={`text-[11px] font-semibold tracking-wider uppercase ${
            isDone
              ? "text-emerald-600 dark:text-emerald-400"
              : sectionName.includes("WATCH")
                ? "text-amber-600 dark:text-amber-400"
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

    // Old-style header line: ends with ":" or is ALL CAPS (but not a § section)
    if (/:\s*$/.test(line) && line.length < 80) {
      elements.push(
        <p key={key++} className="mt-3 mb-1 text-xs font-semibold text-foreground/50 tracking-wider uppercase">
          {line.replace(/:$/, "")}
        </p>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="my-1 leading-relaxed">
        {highlightTerms(line)}
      </p>
    );
  }

  flushBullets();
  return <>{elements}</>;
}
