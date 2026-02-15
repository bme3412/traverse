"use client";

import { SSEEvent } from "@/lib/types";
import { FileText, Loader2, CheckCircle2, Brain, Search } from "lucide-react";
import { useMemo } from "react";

interface LiveActivityFeedProps {
  events: SSEEvent[];
  docsVerified: number;
  totalDocs: number;
  advisoryRunning: boolean;
  advisoryComplete: boolean;
}

export function LiveActivityFeed({
  events,
  docsVerified,
  totalDocs,
  advisoryRunning,
  advisoryComplete
}: LiveActivityFeedProps) {
  // Get recent activity from events
  const activities = useMemo(() => {
    const items: Array<{
      id: string;
      icon: typeof FileText;
      text: string;
      status: "active" | "complete" | "pending";
      timestamp: number;
    }> = [];

    // Track document analysis events
    const docAnalysisStart = events.filter(e => e.type === "doc_analysis_start");
    const docAnalysisResult = events.filter(e => e.type === "doc_analysis_result");
    const docAnalysisThinking = events.filter(e => e.type === "doc_analysis_thinking");

    // Add document analysis activities
    docAnalysisStart.forEach((e, idx) => {
      if (e.type === "doc_analysis_start") {
        const hasResult = docAnalysisResult.some(r =>
          r.type === "doc_analysis_result" && r.requirementName === e.requirementName
        );

        const thinkingForDoc = docAnalysisThinking.filter(t =>
          t.type === "doc_analysis_thinking" && t.requirementName === e.requirementName
        );

        if (hasResult) {
          items.push({
            id: `doc-complete-${idx}`,
            icon: CheckCircle2,
            text: `Verified ${e.requirementName}`,
            status: "complete",
            timestamp: idx
          });
        } else if (thinkingForDoc.length > 0) {
          const latestThinking = thinkingForDoc[thinkingForDoc.length - 1];
          items.push({
            id: `doc-thinking-${idx}`,
            icon: Brain,
            text: latestThinking.type === "doc_analysis_thinking"
              ? `Analyzing ${e.requirementName}: ${latestThinking.excerpt}`
              : `Analyzing ${e.requirementName}...`,
            status: "active",
            timestamp: idx
          });
        } else {
          items.push({
            id: `doc-start-${idx}`,
            icon: FileText,
            text: `Reading ${e.requirementName}...`,
            status: "active",
            timestamp: idx
          });
        }
      }
    });

    // Add advisory status
    if (docsVerified >= totalDocs && totalDocs > 0) {
      if (advisoryComplete) {
        items.push({
          id: "advisory-complete",
          icon: CheckCircle2,
          text: "Assessment complete",
          status: "complete",
          timestamp: items.length
        });
      } else if (advisoryRunning) {
        items.push({
          id: "advisory-running",
          icon: Brain,
          text: "Advisory agent is reviewing your application and preparing recommendations...",
          status: "active",
          timestamp: items.length
        });
      }
    }

    // Show only the last 5 activities
    return items.slice(-5);
  }, [events, docsVerified, totalDocs, advisoryRunning, advisoryComplete]);

  if (activities.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-card/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        <h3 className="text-sm font-semibold text-foreground">Live Activity</h3>
      </div>
      <div className="space-y-2">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const iconColor = activity.status === "complete"
            ? "text-emerald-600 dark:text-emerald-400"
            : activity.status === "active"
            ? "text-blue-600 dark:text-blue-400 animate-pulse"
            : "text-muted-foreground";

          return (
            <div key={activity.id} className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
              <p className="text-xs text-foreground/80 leading-relaxed flex-1">
                {activity.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
