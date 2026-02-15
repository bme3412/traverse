"use client";

import { SSEEvent } from "@/lib/types";
import { Brain, CheckCircle2, FileSearch, Sparkles } from "lucide-react";
import { useMemo } from "react";

interface FloatingAgentStatusProps {
  events: SSEEvent[];
  totalDocs: number;
  advisoryComplete: boolean;
  advisoryRunning: boolean;
  isModalOpen: boolean;
}

interface DocStep {
  requirementName: string;
  docFilename: string;
  status: "complete" | "active" | "pending";
  thinkingExcerpt?: string;
}

export function FloatingAgentStatus({
  events,
  totalDocs,
  advisoryComplete,
  advisoryRunning,
  isModalOpen,
}: FloatingAgentStatusProps) {
  const { steps, activeStep, docsComplete, latestThinking } = useMemo(() => {
    const starts = events.filter(
      (e): e is Extract<SSEEvent, { type: "doc_analysis_start" }> =>
        e.type === "doc_analysis_start"
    );
    const results = events.filter(
      (e): e is Extract<SSEEvent, { type: "doc_analysis_result" }> =>
        e.type === "doc_analysis_result"
    );
    const thinkingEvents = events.filter(
      (e): e is Extract<SSEEvent, { type: "doc_analysis_thinking" }> =>
        e.type === "doc_analysis_thinking"
    );

    const completedNames = new Set(results.map((r) => r.requirementName));

    const builtSteps: DocStep[] = starts.map((s) => {
      const isComplete = completedNames.has(s.requirementName);
      const thinkingForDoc = thinkingEvents.filter(
        (t) => t.requirementName === s.requirementName
      );
      const latest =
        thinkingForDoc.length > 0
          ? thinkingForDoc[thinkingForDoc.length - 1].excerpt
          : undefined;

      return {
        requirementName: s.requirementName,
        docFilename: s.docFilename,
        status: isComplete ? "complete" : "active",
        thinkingExcerpt: latest,
      };
    });

    // The first non-complete step is the active one; all after are pending
    let foundActive = false;
    for (let i = builtSteps.length - 1; i >= 0; i--) {
      if (builtSteps[i].status === "complete") continue;
      if (!foundActive) {
        builtSteps[i].status = "active";
        foundActive = true;
      } else {
        builtSteps[i].status = "pending";
      }
    }

    const active = builtSteps.find((s) => s.status === "active") || null;
    const complete = builtSteps.filter((s) => s.status === "complete").length;

    // Latest thinking from any doc (most recent event)
    const globalLatestThinking =
      thinkingEvents.length > 0
        ? thinkingEvents[thinkingEvents.length - 1].excerpt
        : null;

    return {
      steps: builtSteps,
      activeStep: active,
      docsComplete: complete,
      latestThinking: globalLatestThinking,
    };
  }, [events]);

  // Don't render if no docs started yet
  if (steps.length === 0) return null;

  // Hide when modal is open or advisory is complete (assessment is showing)
  if (isModalOpen) return null;

  // Advisory running after all docs done — show advisory status instead
  const allDocsVerified = docsComplete >= totalDocs && totalDocs > 0;
  const showAdvisoryPhase = allDocsVerified && !advisoryComplete;

  // Once advisory is complete, fade out
  if (advisoryComplete) return null;

  // Truncate thinking to ~140 chars
  const truncatedThinking = latestThinking
    ? latestThinking.length > 140
      ? latestThinking.slice(0, 137) + "..."
      : latestThinking
    : null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90vw] max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="rounded-2xl border border-border/80 bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Top row — current step + counter */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-3">
          {showAdvisoryPhase ? (
            <>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/15 shrink-0">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Preparing your assessment
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All {totalDocs} documents verified — advisory agent is reviewing findings
                </p>
              </div>
            </>
          ) : activeStep ? (
            <>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/15 shrink-0">
                <FileSearch className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Analyzing {activeStep.requirementName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Document {docsComplete + 1} of {totalDocs}
                  {activeStep.docFilename
                    ? ` — ${activeStep.docFilename}`
                    : ""}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Middle row — live thinking excerpt */}
        {truncatedThinking && !showAdvisoryPhase && (
          <div className="px-5 pb-2">
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <Brain className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5 animate-pulse" />
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {truncatedThinking}
              </p>
            </div>
          </div>
        )}

        {/* Bottom row — dot progress */}
        <div className="px-5 pb-4 pt-1 flex items-center gap-2">
          {/* Dots for each doc */}
          <div className="flex items-center gap-1.5 flex-1">
            {Array.from({ length: totalDocs }).map((_, i) => {
              const step = steps[i];
              const status = step?.status || "pending";
              return (
                <div key={i} className="flex items-center gap-1.5">
                  {status === "complete" ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : status === "active" ? (
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center ring-2 ring-blue-500/30 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                  {/* Connector line between dots (not after last) */}
                  {i < totalDocs - 1 && (
                    <div
                      className={`h-0.5 flex-1 min-w-1 rounded-full transition-colors duration-300 ${
                        status === "complete"
                          ? "bg-emerald-500/40"
                          : "bg-muted/60"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {/* Counter label */}
          <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2">
            {docsComplete}/{totalDocs}
          </span>
        </div>
      </div>
    </div>
  );
}
