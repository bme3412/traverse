"use client";

import { useEffect, useState, useMemo } from "react";
import { AgentStatus } from "@/lib/types";
import { UI_CONFIG } from "@/lib/config";
import { useTranslation } from "@/lib/i18n-context";

const AGENT_META: Record<string, { labelKey: string; gradient: string; activeColor: string }> = {
  research: { labelKey: "Research", gradient: "from-blue-500 to-blue-400", activeColor: "text-blue-400" },
  document: { labelKey: "Document Review", gradient: "from-purple-500 to-purple-400", activeColor: "text-purple-400" },
  advisory: { labelKey: "Advisory", gradient: "from-emerald-500 to-emerald-400", activeColor: "text-emerald-400" },
};

const STATUS_KEYS: Record<AgentStatus, { textKey: string; className: string }> = {
  pending: { textKey: "Pending", className: "text-muted-foreground" },
  active: { textKey: "Running", className: "text-amber-400" },
  cached: { textKey: "Cached", className: "text-blue-400" },
  complete: { textKey: "Complete", className: "text-emerald-400" },
  error: { textKey: "Error", className: "text-red-400" },
};

/**
 * Shows the status of all planned agents in a horizontal bar
 * with live elapsed-time counters for active agents.
 */
export function AgentStatusBar({
  statuses,
  plannedAgents,
  agentStartTimes,
}: {
  statuses: Record<string, AgentStatus>;
  plannedAgents: string[];
  agentStartTimes: Record<string, number>;
}) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  const hasActive = plannedAgents.some((a) => statuses[a] === "active");

  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => setTick((t) => t + 1), UI_CONFIG.TIME_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasActive]);

  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), [tick]);

  return (
    <div className="flex items-center gap-5 rounded-xl border border-foreground/[0.08] bg-background/80 backdrop-blur-sm px-5 py-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("Progress")}</span>
      <div className="h-4 w-px bg-secondary" />
      {plannedAgents.map((agent) => {
        const meta = AGENT_META[agent] || { labelKey: agent, gradient: "from-muted-foreground to-muted-foreground", activeColor: "text-muted-foreground" };
        const status = statuses[agent] || "pending";
        const statusInfo = STATUS_KEYS[status];
        const startTime = agentStartTimes[agent];

        let elapsed = "";
        if (status === "active" && startTime) {
          const seconds = ((now - startTime) / 1000).toFixed(1);
          elapsed = ` ${seconds}s`;
        }

        return (
          <div key={agent} className="flex items-center gap-2">
            {/* Status indicator — gradient dot for active/complete, dim for pending */}
            {status === "active" ? (
              <span className={`relative flex h-2 w-2`}>
                <span className={`absolute inset-0 rounded-full bg-gradient-to-r ${meta.gradient} animate-ping opacity-40`} />
                <span className={`relative inline-block h-2 w-2 rounded-full bg-gradient-to-r ${meta.gradient}`} />
              </span>
            ) : status === "complete" ? (
              <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : status === "error" ? (
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/20" />
            )}

            <span className={`font-medium ${status === "active" ? meta.activeColor : status === "complete" ? "text-foreground" : "text-muted-foreground"}`}>
              {t(meta.labelKey)}
            </span>
            <span className={`text-xs ${statusInfo.className}`}>
              {t(statusInfo.textKey)}{elapsed}
            </span>
          </div>
        );
      })}
    </div>
  );
}
