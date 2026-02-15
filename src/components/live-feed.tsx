"use client";

import { useMemo } from "react";
import { SSEEvent, SourceReference } from "@/lib/types";
import { ThinkingPanel } from "./thinking-panel";
import { useTranslation } from "@/lib/i18n-context";

/**
 * Normalize agent names from server format to UI keys.
 */
function agentKey(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("research")) return "research";
  if (lower.includes("document")) return "document";
  if (lower.includes("advisory")) return "advisory";
  return lower;
}

/**
 * Live streaming feed that renders SSE events as they arrive.
 * Thinking events are deduplicated per agent — only the latest
 * thinking state is shown, updated in place.
 */
export function LiveFeed({ events }: { events: SSEEvent[] }) {
  const rendered = useMemo(() => {
    // Accumulate latest thinking state per agent
    const state: Record<string, {
      summary: string;
      excerpt?: string;
      tokens?: number;
      budget?: number;
    }> = {};

    for (const event of events) {
      if (event.type === "thinking") {
        const key = agentKey(event.agent);
        state[key] = {
          ...state[key],
          summary: event.summary,
          excerpt: event.excerpt || state[key]?.excerpt,
        };
      }
      if (event.type === "thinking_depth") {
        const key = agentKey(event.agent);
        state[key] = {
          ...state[key],
          summary: state[key]?.summary || "Adaptive reasoning",
          tokens: event.tokens,
          budget: event.budget,
        };
      }
    }

    // Deduplicate search_status events (keep latest status per source)
    const sourceMap = new Map<string, { source: string; status: string; url?: string }>();
    for (const event of events) {
      if (event.type === "search_status") {
        sourceMap.set(event.source, {
          source: event.source,
          status: event.status,
          url: event.url,
        });
      }
    }
    const dedupedSources = Array.from(sourceMap.values()).filter(
      s => !isRedundantSearchStatus(s.source, s.url)
    );

    const items: React.ReactNode[] = [];
    const thinkingRendered = new Set<string>();
    let sourcesRendered = false;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Render thinking panel (once per agent)
      if (event.type === "thinking" || event.type === "thinking_depth") {
        const key = agentKey(event.agent);
        if (key === "advisory") continue; // handled by AdvisoryCard
        if (!thinkingRendered.has(key)) {
          thinkingRendered.add(key);
          items.push(
            <ThinkingPanel
              key={`thinking-${key}`}
              agent={key}
              summary={state[key].summary}
              excerpt={state[key].excerpt}
              tokens={state[key].tokens}
              budget={state[key].budget}
            />
          );
        }
        continue;
      }

      // Render source discovery block once (after the first search_status)
      if (event.type === "search_status") {
        if (!sourcesRendered && dedupedSources.length > 0) {
          sourcesRendered = true;
          items.push(
            <SourceDiscoveryBlock key="source-discovery" sources={dedupedSources} />
          );
        }
        continue;
      }

      // Skip sources block (rendered inline above), and skip items handled elsewhere
      if (event.type === "sources") continue;

      items.push(<FeedItem key={i} event={event} />);
    }

    return items;
  }, [events]);

  if (events.length === 0) return null;

  return (
    <div className="space-y-2">
      {rendered}
    </div>
  );
}

/* ─── Source Discovery Block ──────────────────────────────────────── */

function SourceDiscoveryBlock({
  sources,
}: {
  sources: Array<{ source: string; status: string; url?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3">
      <div className="space-y-1">
        {sources.map(({ source, status, url }) => (
          <div key={source} className="flex items-center gap-2 text-sm">
            {status === "found" ? (
              <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="h-3.5 w-3.5 flex items-center justify-center shrink-0">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              </span>
            )}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {source}
              </a>
            ) : (
              <span className="text-muted-foreground">{source}</span>
            )}
            {url && <ExternalLinkIcon />}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedItem({ event }: { event: SSEEvent }) {
  switch (event.type) {
    case "orchestrator":
      return <OrchestratorItem event={event} />;
    case "search_status":
      return <SearchStatusItem event={event} />;
    case "requirement":
      return null; // Rendered by ProgressiveRequirements below the feed
    case "sources":
      return <SourcesBlock sources={event.sources} />;
    case "document_read":
      return <DocumentReadItem event={event} />;
    case "cross_lingual":
      return <FindingItem label="Cross-Lingual" severity={event.severity} event={event} />;
    case "forensic":
      return <FindingItem label="Forensic" severity={event.severity} event={event} />;
    case "narrative":
      return <NarrativeItem event={event} />;
    case "recommendation":
      return null; // Rendered by AdvisoryCard
    case "assessment":
      return null; // Rendered by AdvisoryCard
    case "error":
      return (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <span className="shrink-0 text-red-500">!</span>
          <span>{event.message}</span>
        </div>
      );
    case "complete":
      return null;
    default:
      return null;
  }
}

/* ─── Orchestrator ────────────────────────────────────────────────── */
/* All orchestrator events (planning, agent_start, agent_complete) are
   redundant with the progress bar — render nothing in the feed. */

function OrchestratorItem({}: {
  event: Extract<SSEEvent, { type: "orchestrator" }>;
}) {
  return null;
}

/* ─── Search Status ───────────────────────────────────────────────── */

/**
 * Returns true for generic/redundant search_status items that add no value.
 * e.g., "France visa requirements" with no URL — just noise.
 */
function isRedundantSearchStatus(source: string, url?: string): boolean {
  if (url) return false; // If it has a URL, it's useful
  return /visa requirements$/i.test(source)
    || /^web search \d+$/i.test(source);
}

function SearchStatusItem({
  event,
}: {
  event: Extract<SSEEvent, { type: "search_status" }>;
}) {
  // Skip redundant generic search items
  if (isRedundantSearchStatus(event.source, event.url)) return null;

  const sourceLabel = event.url ? (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-border underline-offset-2 hover:decoration-muted-foreground hover:text-foreground transition-colors"
    >
      {event.source}
    </a>
  ) : (
    event.source
  );

  if (event.status === "found") {
    return (
      <div className="flex items-center gap-2.5 py-1 pl-1 text-sm">
        <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-foreground">{sourceLabel}</span>
        {event.url && <ExternalLinkIcon />}
      </div>
    );
  }

  if (event.status === "searching") {
    return (
      <div className="flex items-center gap-2.5 py-1 pl-1 text-sm text-muted-foreground">
        <span className="inline-block h-3.5 w-3.5 shrink-0 text-center text-xs leading-[14px] animate-pulse">…</span>
        <span>{event.source}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-1 pl-1 text-sm text-muted-foreground">
      <span className="inline-block h-3.5 w-3.5 shrink-0 text-center text-xs leading-[14px]">✗</span>
      <span>{event.source}</span>
    </div>
  );
}

/* ─── Sources Citation Block ──────────────────────────────────────── */

function SourcesBlock({ sources }: { sources: SourceReference[] }) {
  const { t } = useTranslation();
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 mb-1 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("Sources")}</p>
      <div className="space-y-1.5">
        {sources.map((source, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs tabular-nums shrink-0">{i + 1}.</span>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline decoration-blue-600/30 dark:decoration-blue-400/20 underline-offset-2 hover:decoration-blue-600/60 dark:hover:decoration-blue-400/50 transition-colors"
              >
                {source.name}
              </a>
            ) : (
              <span className="text-muted-foreground">{source.name}</span>
            )}
            {source.url && <ExternalLinkIcon />}
            {source.dateAccessed && (
              <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">
                {t("accessed")} {source.dateAccessed}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared: External link icon ──────────────────────────────────── */

function ExternalLinkIcon() {
  return (
    <svg className="h-3 w-3 text-muted-foreground shrink-0" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2H2.5C1.95 2 1.5 2.45 1.5 3v6.5c0 .55.45 1 1 1H9c.55 0 1-.45 1-1V7.5M7 1.5h3.5m0 0V5m0-3.5L6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Document Read ───────────────────────────────────────────────── */

function DocumentReadItem({
  event,
}: {
  event: Extract<SSEEvent, { type: "document_read" }>;
}) {
  const isNonEnglish = event.language.toLowerCase() !== "english";
  return (
    <div className="flex items-center gap-2.5 py-1.5 pl-1">
      <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-sm text-foreground">
        {event.doc}
        {isNonEnglish && (
          <span className="ml-2 text-xs text-amber-400/80 font-medium">{event.language}</span>
        )}
      </span>
    </div>
  );
}

/* ─── Findings (cross-lingual, forensic) ──────────────────────────── */

function FindingItem({
  label,
  severity,
  event,
}: {
  label: string;
  severity: string;
  event: Extract<SSEEvent, { type: "cross_lingual" }> | Extract<SSEEvent, { type: "forensic" }>;
}) {
  const severityStyles =
    severity === "critical"
      ? "border-red-500/20 bg-red-500/5 text-red-400"
      : severity === "warning"
        ? "border-amber-500/20 bg-amber-500/5 text-amber-400"
        : "border-blue-500/20 bg-blue-500/5 text-blue-400";

  const tagStyles =
    severity === "critical"
      ? "bg-red-500/15 text-red-400"
      : severity === "warning"
        ? "bg-amber-500/15 text-amber-400"
        : "bg-blue-500/15 text-blue-400";

  return (
    <div className={`rounded-lg border px-4 py-3 my-1.5 ${severityStyles}`}>
      <div className="flex items-start gap-2.5">
        <span className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tagStyles}`}>
          {label}
        </span>
        <div>
          <p className="text-sm font-medium">{event.finding}</p>
          {event.details && (
            <p className="mt-1 text-xs opacity-70 leading-relaxed">{event.details}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Narrative ───────────────────────────────────────────────────── */

function NarrativeItem({
  event,
}: {
  event: Extract<SSEEvent, { type: "narrative" }>;
}) {
  const { t } = useTranslation();
  const assessmentStyles =
    event.assessment === "WEAK"
      ? "border-red-500/20 bg-red-500/5 text-red-400"
      : event.assessment === "MODERATE"
        ? "border-amber-500/20 bg-amber-500/5 text-amber-400"
        : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400";

  const badgeStyles =
    event.assessment === "WEAK"
      ? "bg-red-500/15 text-red-400"
      : event.assessment === "MODERATE"
        ? "bg-amber-500/15 text-amber-400"
        : "bg-emerald-500/15 text-emerald-400";

  return (
    <div className={`rounded-lg border px-4 py-3 my-1.5 ${assessmentStyles}`}>
      <div className="flex items-start gap-2.5">
        <span className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeStyles}`}>
          {t("Narrative")}
        </span>
        <div>
          <p className="text-sm font-medium">
            {t("Coherence:")} {event.assessment}
            <span className="ml-2 font-normal opacity-70">
              — {event.issues} {event.issues !== 1 ? t("issues") : t("issue")}
            </span>
          </p>
          {event.details && (
            <p className="mt-1 text-xs opacity-70 leading-relaxed">{event.details}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Recommendation ──────────────────────────────────────────────── */

function RecommendationItem({
  event,
}: {
  event: Extract<SSEEvent, { type: "recommendation" }>;
}) {
  const { tDynamic } = useTranslation();
  const icon =
    event.priority === "critical" ? (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-[10px] text-red-400 font-bold">!</span>
    ) : event.priority === "warning" ? (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] text-amber-400 font-bold">!</span>
    ) : (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] text-blue-400">i</span>
    );

  const translatedAction = tDynamic(event.action);

  return (
    <div className="flex items-center gap-2.5 py-1.5 pl-1 text-sm text-foreground">
      {icon}
      <span key={translatedAction} className="animate-translate-in">{translatedAction}</span>
    </div>
  );
}

/* ─── Assessment ──────────────────────────────────────────────────── */

function AssessmentItem({
  event,
}: {
  event: Extract<SSEEvent, { type: "assessment" }>;
}) {
  const { t } = useTranslation();
  const label = event.overall
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const styles =
    event.overall === "APPLICATION_PROCEEDS"
      ? "from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-400"
      : event.overall === "ADDITIONAL_DOCUMENTS_NEEDED"
        ? "from-amber-500/20 to-amber-500/0 border-amber-500/30 text-amber-400"
        : "from-red-500/20 to-red-500/0 border-red-500/30 text-red-400";

  return (
    <div className={`mt-4 rounded-lg border bg-gradient-to-r p-4 text-center ${styles}`}>
      <p className="text-xs uppercase tracking-widest opacity-60 mb-1">{t("Overall Assessment")}</p>
      <p className="text-lg font-semibold tracking-tight">{label}</p>
    </div>
  );
}
