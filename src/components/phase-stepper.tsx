"use client";

/**
 * Phase Stepper — Slim horizontal progress indicator.
 *
 * Three phases:
 *   1. Research  — AI analyzes corridor
 *   2. Documents — User uploads & verifies
 *   3. Assessment — Personalized report
 *
 * Compact single-line design that stays out of the way.
 */

import { useEffect, useState } from "react";
import { AgentStatus } from "@/lib/types";
import { UI_CONFIG } from "@/lib/config";
import { useTranslation } from "@/lib/i18n-context";

export type Phase = "research" | "documents" | "advisory";
export type PhaseStatus = "pending" | "active" | "complete";

interface PhaseStepperProps {
  agentStatuses: Record<string, AgentStatus>;
  agentStartTimes: Record<string, number>;
  docsVerified: number;
  docsTotal: number;
  advisoryReady: boolean;
  advisoryRunning: boolean;
}

const PHASES: { id: Phase; label: string }[] = [
  { id: "research", label: "Research" },
  { id: "documents", label: "Documents" },
  { id: "advisory", label: "Assessment" },
];

export function PhaseStepper({
  agentStatuses,
  agentStartTimes,
  docsVerified,
  docsTotal,
  advisoryReady,
  advisoryRunning,
}: PhaseStepperProps) {
  const { t } = useTranslation();

  const researchStatus = agentStatuses.research;
  const researchDone = researchStatus === "complete" || researchStatus === "cached";

  const phaseStatuses: Record<Phase, PhaseStatus> = {
    research: researchDone ? "complete" : researchStatus === "active" ? "active" : "pending",
    documents: researchDone
      ? docsTotal > 0 && docsVerified >= docsTotal
        ? "complete"
        : "active"
      : "pending",
    advisory: advisoryReady
      ? "complete"
      : advisoryRunning
        ? "active"
        : "pending",
  };

  // Elapsed timer for active research
  const [now, setNow] = useState(0);
  const isResearching = researchStatus === "active";
  useEffect(() => {
    if (!isResearching) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), UI_CONFIG.TIME_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isResearching]);

  return (
    <div className="sticky top-0 z-20 -mx-6 px-6 py-2.5 bg-background/95 backdrop-blur-sm border-b border-border/30 mb-6">
      <div className="flex items-center gap-1">
        {PHASES.map((phase, idx) => {
          const status = phaseStatuses[phase.id];

          // Inline status hint
          let hint = "";
          if (phase.id === "research" && status === "active") {
            const start = agentStartTimes.research;
            if (start && now) hint = `${((now - start) / 1000).toFixed(0)}s`;
          }
          if (phase.id === "documents" && status === "active" && docsVerified > 0) {
            hint = `${docsVerified}/${docsTotal}`;
          }

          return (
            <div key={phase.id} className="flex items-center gap-1 flex-1 min-w-0">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-500 ${
                  status === "complete"
                    ? "bg-emerald-500"
                    : status === "active"
                      ? "bg-blue-500"
                      : "bg-muted-foreground/20"
                }`} />
                {/* Label */}
                <span className={`text-xs font-medium truncate transition-colors duration-500 ${
                  status === "complete"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : status === "active"
                      ? "text-foreground"
                      : "text-muted-foreground/40"
                }`}>
                  {t(phase.label)}
                </span>
                {/* Hint */}
                {hint && (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{hint}</span>
                )}
              </div>

              {/* Connector */}
              {idx < PHASES.length - 1 && (
                <div className={`flex-1 h-px min-w-3 transition-colors duration-500 ${
                  phaseStatuses[PHASES[idx + 1].id] !== "pending"
                    ? "bg-emerald-500/30"
                    : "bg-border/60"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
