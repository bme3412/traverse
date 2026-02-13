"use client";

/**
 * Progressive Requirements Checklist
 *
 * Displays visa requirements one at a time in a calm, non-overwhelming way.
 * Requirements appear progressively with smooth animations and auto-scroll.
 */

import { RequirementsChecklist, RequirementItem, ComplianceItem } from "@/lib/types";
import { CheckCircle2, AlertCircle, Circle, ChevronDown, ChevronLeft, Pause, Play } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface ProgressiveChecklistProps {
  requirements: RequirementsChecklist;
  compliance?: ComplianceItem[];
  isStreaming?: boolean;
}

export function ProgressiveChecklist({
  requirements,
  compliance,
  isStreaming = false,
}: ProgressiveChecklistProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);

  const totalRequirements = requirements.items.length;
  const hasMore = visibleCount < totalRequirements;

  // Auto-reveal requirements one by one
  useEffect(() => {
    if (isPaused || !hasMore || !isStreaming) return;

    const timer = setTimeout(() => {
      setVisibleCount((prev) => prev + 1);
    }, 1500); // 1.5 second delay between items

    return () => clearTimeout(timer);
  }, [visibleCount, isPaused, hasMore, isStreaming]);

  // When streaming completes, show all remaining items
  useEffect(() => {
    if (!isStreaming && visibleCount < totalRequirements) {
      setVisibleCount(totalRequirements);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [isStreaming, visibleCount, totalRequirements]);

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const jumpToStep = (index: number) => {
    setVisibleCount(index + 1);
    setTimeout(() => {
      const element = document.getElementById(`requirement-${index}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const goBack = () => {
    if (visibleCount > 1) {
      jumpToStep(visibleCount - 2);
    }
  };

  const getComplianceStatus = (
    itemName: string
  ): "met" | "warning" | "critical" | "not_checked" => {
    if (!compliance) return "not_checked";
    const match = compliance.find((c) =>
      c.requirement.toLowerCase().includes(itemName.toLowerCase()) ||
      itemName.toLowerCase().includes(c.requirement.toLowerCase())
    );
    return match?.status || "not_checked";
  };

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Header with Progress */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Visa Requirements</h2>
          {isStreaming && hasMore && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Checking requirement {visibleCount + 1} of {totalRequirements}...</span>
            </div>
          )}
          {!isStreaming && (
            <span className="text-sm text-green-500">✓ All requirements loaded</span>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{requirements.corridor}</p>
            <p>{requirements.visaType}</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${(visibleCount / totalRequirements) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{visibleCount} of {totalRequirements} requirements</span>
            <span>{Math.round((visibleCount / totalRequirements) * 100)}% complete</span>
          </div>
        </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-3">
        {requirements.items.slice(0, visibleCount).map((item, index) => {
          const status = getComplianceStatus(item.name);
          const isExpanded = expandedItems.has(index);
          const isCurrent = index === visibleCount - 1 && isStreaming && hasMore;
          const isPrevious = index < visibleCount - 1;

          return (
            <div
              key={index}
              id={`requirement-${index}`}
              ref={isCurrent ? currentItemRef : null}
              className={`
                border rounded-lg overflow-hidden transition-all duration-500
                ${isCurrent ? 'border-blue-500 shadow-lg shadow-blue-500/20 scale-100' : 'border-border'}
                ${isPrevious ? 'opacity-70 scale-[0.98]' : 'opacity-100'}
                animate-in slide-in-from-bottom-4 fade-in
              `}
              style={{
                animationDuration: '500ms',
                animationDelay: '0ms',
              }}
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {status === "met" && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {status === "warning" && (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  )}
                  {status === "critical" && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  {status === "not_checked" && (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {/* Step Number */}
                      <div className="text-xs text-muted-foreground mb-1">
                        Requirement {index + 1} of {totalRequirements}
                      </div>

                      <p className="font-medium text-foreground">
                        {item.name}
                        {item.required && (
                          <span className="ml-2 text-red-400 text-sm">*</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                      {item.personalizedDetail && (
                        <p className="text-sm text-blue-400 mt-1">
                          → {item.personalizedDetail}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {/* Confidence Badge */}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        item.confidence === "high"
                          ? "bg-green-500/20 text-green-400"
                          : item.confidence === "medium"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {item.confidence} confidence
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 border-t border-border pt-3 animate-in slide-in-from-top-2 fade-in">
                  {item.source && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Source: </span>
                      <span className="text-foreground">{item.source}</span>
                    </div>
                  )}
                  {status !== "not_checked" && compliance && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Status: </span>
                      <span
                        className={
                          status === "met"
                            ? "text-green-400"
                            : status === "warning"
                            ? "text-yellow-400"
                            : "text-red-400"
                        }
                      >
                        {status === "met" && "✓ Satisfied by uploaded documents"}
                        {status === "warning" && "⚠ Partial or unclear"}
                        {status === "critical" && "✗ Missing or incorrect"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator for next item */}
        {isStreaming && hasMore && (
          <div className="border border-dashed border-border rounded-lg px-4 py-6 flex items-center justify-center gap-3 text-muted-foreground animate-pulse">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-sm">Loading next requirement...</span>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {visibleCount > 0 && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-4 pb-2">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={goBack}
              disabled={visibleCount <= 1}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-foreground hover:text-foreground hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Step {visibleCount} of {totalRequirements}</span>
            </div>

            {isStreaming && hasMore && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-foreground hover:text-foreground hover:border-border transition-colors"
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                )}
              </button>
            )}

            {(!isStreaming || !hasMore) && (
              <div className="px-4 py-2 text-sm text-green-500">
                ✓ Complete
              </div>
            )}
          </div>

          {/* Quick Jump (for completed steps) */}
          {visibleCount > 3 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Jump to requirement:</div>
              <div className="flex flex-wrap gap-2">
                {requirements.items.slice(0, visibleCount).map((item, index) => (
                  <button
                    key={index}
                    onClick={() => jumpToStep(index)}
                    className={`
                      px-2 py-1 rounded text-xs transition-colors
                      ${index === visibleCount - 1
                        ? 'bg-blue-500 text-white'
                        : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                      }
                    `}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
