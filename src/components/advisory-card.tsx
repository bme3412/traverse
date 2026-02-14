"use client";

/**
 * Advisory Card — dedicated presentation for the advisory agent output.
 *
 * Three tiers:
 * 1. Assessment verdict (bold header, color-coded)
 * 2. Numbered action items with severity + left-border
 * 3. Thinking panel (collapsed by default)
 */

import { SSEEvent, ApplicationAssessment, Severity } from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";

interface AdvisoryCardProps {
  events: SSEEvent[];
}

/** Normalize agent name to key */
function isAdvisoryAgent(agent: string): boolean {
  return agent.toLowerCase().includes("advisory");
}

export function AdvisoryCard({ events }: AdvisoryCardProps) {
  const { t, tDynamic } = useTranslation();
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Extract advisory data from events
  const { assessment, recommendations, thinkingText, isStreaming } = useMemo(() => {
    let assessment: ApplicationAssessment | null = null;
    const recommendations: { priority: Severity; action: string; details?: string }[] = [];
    let thinkingText = "";
    let advisoryStarted = false;
    let advisoryComplete = false;

    for (const e of events) {
      if (e.type === "orchestrator" && e.agent && isAdvisoryAgent(e.agent)) {
        if (e.action === "agent_start") advisoryStarted = true;
        if (e.action === "agent_complete") advisoryComplete = true;
      }
      if (e.type === "assessment") {
        assessment = e.overall;
      }
      if (e.type === "recommendation") {
        recommendations.push({
          priority: e.priority,
          action: e.action,
          details: e.details,
        });
      }
      if (e.type === "thinking" && isAdvisoryAgent(e.agent)) {
        thinkingText = e.excerpt || e.summary || thinkingText;
      }
    }

    return {
      assessment,
      recommendations,
      thinkingText,
      isStreaming: advisoryStarted && !advisoryComplete,
    };
  }, [events]);

  // Auto-scroll thinking panel
  useEffect(() => {
    if (scrollRef.current && thinkingOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinkingText, thinkingOpen]);

  // Don't render if no advisory events
  const hasAdvisory = assessment || recommendations.length > 0 || isStreaming;
  if (!hasAdvisory) return null;

  // Assessment styling
  const assessmentConfig = getAssessmentConfig(assessment);

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Tier 1: Assessment Verdict */}
      <div className={`px-5 py-4 ${assessmentConfig.bg}`}>
        <div className="flex items-center gap-3">
          {assessmentConfig.icon}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("Advisory Assessment")}
            </p>
            {assessment ? (
              <p className={`text-lg font-bold tracking-tight ${assessmentConfig.text}`}>
                {t(assessmentConfig.label)}
              </p>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-sm text-muted-foreground">{t("Analyzing application...")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier 2: Action Items */}
      {recommendations.length > 0 && (
        <div className="border-t border-border/40">
          {recommendations.map((rec, i) => {
            const sevConfig = getSeverityConfig(rec.priority);
            return (
              <div
                key={i}
                className={`flex gap-3 px-5 py-3 border-l-[3px] ${sevConfig.border} ${
                  i < recommendations.length - 1 ? "border-b border-b-border/30" : ""
                }`}
              >
                {/* Priority number */}
                <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${sevConfig.badge}`}>
                  {i + 1}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${sevConfig.label}`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {tDynamic(rec.action)}
                  </p>
                  {rec.details && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {tDynamic(rec.details)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tier 3: Thinking (collapsed by default) */}
      {thinkingText && (
        <div className="border-t border-border/40">
          <button
            onClick={() => setThinkingOpen(!thinkingOpen)}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-left hover:bg-secondary/30 transition-colors"
          >
            {thinkingOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-emerald-500/60" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-emerald-500/60" />
            )}
            <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-600/60 dark:text-emerald-400/50">
              {t("Advisory Reasoning")}
            </span>
            {isStreaming && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
            )}
          </button>
          {thinkingOpen && (
            <div
              ref={scrollRef}
              className="border-t border-border/30 px-5 py-4 text-sm text-foreground/60 leading-[1.8] max-h-64 overflow-y-auto bg-emerald-50/30 dark:bg-emerald-950/5"
            >
              <FormatAdvisoryThinking text={thinkingText} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Assessment config ─────────────────────────────────────────── */

function getAssessmentConfig(assessment: ApplicationAssessment | null) {
  if (assessment === "APPLICATION_PROCEEDS") {
    return {
      bg: "bg-emerald-500/5 dark:bg-emerald-950/20",
      text: "text-emerald-700 dark:text-emerald-400",
      label: "Application Proceeds",
      icon: <CheckCircle2 className="w-7 h-7 text-emerald-500 flex-shrink-0" />,
    };
  }
  if (assessment === "SIGNIFICANT_ISSUES") {
    return {
      bg: "bg-red-500/5 dark:bg-red-950/20",
      text: "text-red-700 dark:text-red-400",
      label: "Significant Issues",
      icon: <XCircle className="w-7 h-7 text-red-500 flex-shrink-0" />,
    };
  }
  // ADDITIONAL_DOCUMENTS_NEEDED or streaming/null
  return {
    bg: "bg-amber-500/5 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    label: assessment ? "Additional Documents Needed" : "Analyzing...",
    icon: <AlertTriangle className="w-7 h-7 text-amber-500 flex-shrink-0" />,
  };
}

/* ─── Severity config ───────────────────────────────────────────── */

function getSeverityConfig(severity: Severity) {
  if (severity === "critical") {
    return {
      border: "border-l-red-500",
      badge: "bg-red-500/15 text-red-600 dark:text-red-400",
      label: "text-red-600 dark:text-red-400",
    };
  }
  if (severity === "warning") {
    return {
      border: "border-l-amber-500",
      badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      label: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    border: "border-l-blue-500",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    label: "text-blue-600 dark:text-blue-400",
  };
}

/* ─── Thinking text formatter (lightweight) ─────────────────────── */

function FormatAdvisoryThinking({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Bullet/numbered items
    if (/^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const content = line.replace(/^[-•*]\s+/, "").replace(/^\d+[.)]\s+/, "");
      elements.push(
        <div key={key++} className="flex gap-2 ml-1 my-0.5">
          <span className="text-emerald-500/40 select-none shrink-0">›</span>
          <span>{content}</span>
        </div>
      );
      continue;
    }

    // Regular text
    elements.push(
      <p key={key++} className="my-1">
        {line}
      </p>
    );
  }

  return <>{elements}</>;
}
