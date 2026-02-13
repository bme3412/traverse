"use client";

/**
 * Progressive Requirements Display with Per-Requirement Upload
 *
 * Each requirement is an interactive row with:
 * - Requirement info (left)
 * - Upload zone (right) for uploadable requirements
 * - Status: pending → uploaded → analyzing → passed/flagged
 * - Inline thinking + result display per requirement
 *
 * All visible text goes through t() for translation support.
 */

import {
  SSEEvent,
  RequirementItem,
  ComplianceItem,
  DocumentExtraction,
  CrossDocFinding,
} from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import { LANGUAGES } from "@/components/language-selector";
import {
  CheckCircle2,
  AlertCircle,
  Circle,
  ChevronDown,
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

type RequirementStatus =
  | "pending"
  | "uploaded"
  | "analyzing"
  | "passed"
  | "warning"
  | "flagged"
  | "error";

interface RequirementState {
  status: RequirementStatus;
  file?: File;
  thinking?: string;
  compliance?: ComplianceItem;
  crossDocFindings?: CrossDocFinding[];
  extraction?: DocumentExtraction;
}

interface ProgressiveRequirementsProps {
  events: SSEEvent[];
  isStreaming: boolean;
  compliance?: ComplianceItem[];
  corridorInfo?: { corridor: string; visaType: string };
  onAllDocumentsAnalyzed?: (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => void;
}

export function ProgressiveRequirements({
  events,
  isStreaming,
  compliance,
  corridorInfo,
  onAllDocumentsAnalyzed,
}: ProgressiveRequirementsProps) {
  const { t, language, isTranslating, translatedRequirements, translatedCorridorInfo } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [requirementStates, setRequirementStates] = useState<
    Map<number, RequirementState>
  >(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);
  // Track all extractions for cross-document checking
  const extractionsRef = useRef<DocumentExtraction[]>([]);

  // Build a map from source name → URL using search_status and sources events.
  // Also supports fuzzy matching (substring) for when the model names sources
  // slightly differently in requirements vs search events.
  const sourceUrlMap = useMemo(() => {
    const exactMap = new Map<string, string>();
    for (const e of events) {
      if (e.type === "search_status" && e.url && e.source) {
        exactMap.set(e.source, e.url);
      }
      if (e.type === "sources") {
        for (const src of e.sources) {
          if (src.name && src.url) {
            exactMap.set(src.name, src.url);
          }
        }
      }
    }
    // Return a proxy-like getter that falls back to substring matching
    return {
      get(name: string): string | undefined {
        if (exactMap.has(name)) return exactMap.get(name);
        // Fuzzy: check if any key contains the name or vice versa
        const lower = name.toLowerCase();
        for (const [key, url] of exactMap) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes(lower) || lower.includes(keyLower)) {
            return url;
          }
        }
        return undefined;
      },
    };
  }, [events]);

  // Build requirements list from SSE "requirement" events
  const requirements = useMemo(() => {
    return events
      .filter((e) => e.type === "requirement")
      .map((e) => {
        if (e.type === "requirement") {
          return {
            name: e.item,
            description: e.detail || "",
            required: e.depth != null && e.depth > 1,
            source: e.source,
            confidence: "high" as const,
            personalizedDetail: undefined,
            uploadable: e.uploadable ?? true,
            universal: e.universal ?? false,
          };
        }
        return null;
      })
      .filter(Boolean) as RequirementItem[];
  }, [events]);

  const totalRequirements = requirements.length;
  const uploadableCount = requirements.filter((r) => r.uploadable).length;
  const analyzedCount = Array.from(requirementStates.values()).filter(
    (s) => s.status === "passed" || s.status === "warning" || s.status === "flagged"
  ).length;

  // Check if all uploadable docs are analyzed
  useEffect(() => {
    if (uploadableCount > 0 && analyzedCount === uploadableCount && onAllDocumentsAnalyzed) {
      const allExtractions = extractionsRef.current;
      const allCompliances = Array.from(requirementStates.values())
        .filter((s) => s.compliance)
        .map((s) => s.compliance!);
      onAllDocumentsAnalyzed(allExtractions, allCompliances);
    }
  }, [analyzedCount, uploadableCount, requirementStates, onAllDocumentsAnalyzed]);

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getComplianceStatus = (
    itemName: string
  ): "met" | "warning" | "critical" | "not_checked" => {
    if (!compliance) return "not_checked";
    const match = compliance.find(
      (c) =>
        c.requirement.toLowerCase().includes(itemName.toLowerCase()) ||
        itemName.toLowerCase().includes(c.requirement.toLowerCase())
    );
    return match?.status || "not_checked";
  };

  // Handle file upload for a specific requirement
  const handleFileUpload = useCallback(
    async (index: number, file: File) => {
      const requirement = requirements[index];
      if (!requirement) return;

      // Validate file
      const validTypes = ["image/png", "image/jpeg"];
      if (!validTypes.includes(file.type)) {
        setRequirementStates((prev) => {
          const next = new Map(prev);
          next.set(index, { status: "error", file });
          return next;
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setRequirementStates((prev) => {
          const next = new Map(prev);
          next.set(index, { status: "error", file });
          return next;
        });
        return;
      }

      // Convert to base64
      const base64 = await fileToBase64(file);

      // Update state: uploaded → analyzing
      setRequirementStates((prev) => {
        const next = new Map(prev);
        next.set(index, { status: "analyzing", file, thinking: "Reading document..." });
        return next;
      });

      // Expand the item to show inline thinking
      setExpandedItems((prev) => new Set(prev).add(index));

      try {
        // Call per-document analysis endpoint
        const response = await fetch("/api/analyze/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: {
              id: `doc-${index}-${Date.now()}`,
              filename: file.name,
              base64,
              mimeType: file.type,
              sizeBytes: file.size,
            },
            requirement: {
              name: requirement.name,
              description: requirement.description,
              required: requirement.required,
              confidence: requirement.confidence,
            },
            previousExtractions: extractionsRef.current,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Stream the SSE response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") break;

              try {
                const event = JSON.parse(data);

                if (event.type === "doc_analysis_thinking") {
                  setRequirementStates((prev) => {
                    const next = new Map(prev);
                    const current = next.get(index) || { status: "analyzing" as const, file };
                    next.set(index, { ...current, thinking: event.excerpt });
                    return next;
                  });
                }

                if (event.type === "doc_analysis_result") {
                  const complianceResult: ComplianceItem = event.compliance;
                  const newStatus: RequirementStatus =
                    complianceResult.status === "met"
                      ? "passed"
                      : complianceResult.status === "warning"
                        ? "warning"
                        : "flagged";

                  // Store extraction for future cross-checks
                  if (event.extraction) {
                    extractionsRef.current = [
                      ...extractionsRef.current,
                      event.extraction,
                    ];
                  }

                  setRequirementStates((prev) => {
                    const next = new Map(prev);
                    next.set(index, {
                      status: newStatus,
                      file,
                      compliance: complianceResult,
                      crossDocFindings: event.crossDocFindings,
                      extraction: event.extraction,
                    });
                    return next;
                  });
                }
              } catch {
                // Skip parse errors
              }
            }
          }
        }
      } catch (error) {
        setRequirementStates((prev) => {
          const next = new Map(prev);
          next.set(index, {
            status: "error",
            file,
            thinking: error instanceof Error ? error.message : "Analysis failed",
          });
          return next;
        });
      }
    },
    [requirements]
  );

  // Handle drag & drop for a requirement
  const handleDrop = useCallback(
    (index: number, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(index, file);
    },
    [handleFileUpload]
  );

  // Handle click-to-browse for a requirement
  const handleBrowse = useCallback(
    (index: number) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) handleFileUpload(index, file);
      };
      input.click();
    },
    [handleFileUpload]
  );

  if (totalRequirements === 0 && !isStreaming) {
    return null;
  }

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Header with Progress */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">{t("Visa Requirements")}</h2>
          {isTranslating && (
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t("Translating to")} {language}...</span>
            </div>
          )}
          {!isTranslating && isStreaming && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span>{t("Checking requirements...")}</span>
            </div>
          )}
          {!isTranslating && !isStreaming && totalRequirements > 0 && (
            <span className="text-sm text-green-500">
              {analyzedCount > 0
                ? `${analyzedCount}/${uploadableCount} ${t("documents checked")}`
                : language !== "English"
                  ? `${t("Showing in")} ${LANGUAGES.find(l => l.name === language)?.nativeName || language}`
                  : t("All requirements loaded")}
            </span>
          )}
        </div>

        {corridorInfo && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {translatedCorridorInfo?.corridor || corridorInfo.corridor}
              </p>
              <p>{translatedCorridorInfo?.visaType || corridorInfo.visaType}</p>
            </div>

            {totalRequirements > 0 && (
              <>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500 ease-out"
                    style={{
                      width: `${uploadableCount > 0
                        ? (analyzedCount / uploadableCount) * 100
                        : (totalRequirements / 13) * 100
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{totalRequirements} {t("requirements found")}</span>
                  {analyzedCount > 0 && (
                    <span>{analyzedCount} {t("of")} {uploadableCount} {t("documents checked")}</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Requirements List */}
      <div className="space-y-3">
        {requirements.map((item, index) => {
          const externalStatus = getComplianceStatus(item.name);
          const reqState = requirementStates.get(index);
          const isExpanded = expandedItems.has(index);
          const isLast = index === requirements.length - 1;

          // Determine visual status
          const status = reqState?.status || "pending";
          const statusFromCompliance =
            reqState?.compliance?.status || externalStatus;

          // Get translated text for this requirement
          const translated = translatedRequirements.get(item.name);
          const displayName = translated?.name || item.name;
          const displayDesc = translated?.description || item.description;
          // English original reference is no longer shown — full translation only

          return (
            <div
              key={`${item.name}-${index}`}
              id={`requirement-${index}`}
              ref={isLast && isStreaming ? currentItemRef : null}
              className={`
                border rounded-lg overflow-hidden transition-all duration-300
                ${status === "analyzing"
                  ? "border-blue-500 shadow-lg shadow-blue-500/10"
                  : status === "passed"
                    ? "border-green-500/50"
                    : status === "flagged"
                      ? "border-red-500/50"
                      : status === "warning"
                        ? "border-yellow-500/50"
                        : item.universal
                          ? "border-blue-400/30"
                          : "border-border"
                }
                animate-in slide-in-from-bottom-4 fade-in
              `}
              style={{ animationDuration: "400ms" }}
              onDragOver={(e) => {
                if (item.uploadable) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onDrop={(e) => {
                if (item.uploadable && status === "pending") {
                  handleDrop(index, e);
                }
              }}
            >
              {/* Main requirement row */}
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Status Icon */}
                <button
                  onClick={() => toggleItem(index)}
                  className="flex-shrink-0 mt-0.5 hover:opacity-80 transition-opacity"
                  title={`Toggle details for ${item.name}`}
                  aria-label={`Toggle details for ${item.name}`}
                >
                  <StatusIcon status={status} complianceStatus={statusFromCompliance} />
                </button>

                {/* Requirement Info */}
                <button
                  onClick={() => toggleItem(index)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {t("Requirement")} {index + 1}
                        {item.universal && (
                          <span className="ml-2 text-blue-400">({t("universal")})</span>
                        )}
                      </div>
                      <p className={`font-medium text-foreground ${isTranslating ? "opacity-50" : ""} transition-opacity`}>
                        {displayName}
                        {item.required && (
                          <span className="ml-1.5 text-red-400 text-sm">*</span>
                        )}
                      </p>
                      <p className={`text-sm text-muted-foreground mt-0.5 line-clamp-2 ${isTranslating ? "opacity-50" : ""} transition-opacity`}>
                        {displayDesc}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Upload zone (right side) */}
                {item.uploadable && status === "pending" && (
                  <button
                    onClick={() => handleBrowse(index)}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-md
                      border border-dashed border-border hover:border-blue-400
                      text-xs text-muted-foreground hover:text-blue-400
                      transition-all hover:bg-blue-500/5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t("Upload")}</span>
                  </button>
                )}

                {/* Upload status badges */}
                {status === "uploaded" && (
                  <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{reqState?.file?.name}</span>
                  </div>
                )}

                {status === "analyzing" && (
                  <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-blue-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("Analyzing...")}</span>
                  </div>
                )}

                {(status === "passed" || status === "warning" || status === "flagged") && (
                  <div className="flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        status === "passed"
                          ? "bg-green-500/15 text-green-400"
                          : status === "warning"
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {status === "passed" && t("Verified")}
                      {status === "warning" && t("Warning")}
                      {status === "flagged" && t("Issue Found")}
                    </span>
                  </div>
                )}

                {!item.uploadable && status === "pending" && (
                  <div className="flex-shrink-0 text-xs text-muted-foreground px-2 py-1">
                    {t("Info only")}
                  </div>
                )}
              </div>

              {/* Expanded Details / Inline Analysis */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-3 animate-in slide-in-from-top-2 fade-in">
                  {/* Source info — clickable link when URL is available */}
                  {item.source && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t("Source")}: </span>
                      {sourceUrlMap.get(item.source) ? (
                        <a
                          href={sourceUrlMap.get(item.source)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 underline decoration-blue-600/30 dark:decoration-blue-400/20 underline-offset-2 hover:decoration-blue-600/60 dark:hover:decoration-blue-400/50 transition-colors inline-flex items-center gap-1"
                        >
                          {item.source}
                          <svg className="h-3 w-3 shrink-0 opacity-60" viewBox="0 0 12 12" fill="none">
                            <path d="M4.5 2H2.5C1.95 2 1.5 2.45 1.5 3v6.5c0 .55.45 1 1 1H9c.55 0 1-.45 1-1V7.5M7 1.5h3.5m0 0V5m0-3.5L6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-foreground">{item.source}</span>
                      )}
                    </div>
                  )}

                  {/* Confidence badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                      {t(`${item.confidence} confidence`)}
                    </span>
                    {item.uploadable && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        {t("document required")}
                      </span>
                    )}
                  </div>

                  {/* Inline thinking panel */}
                  {reqState?.thinking && status === "analyzing" && (
                    <div className="rounded-md bg-card/60 border border-border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        <span className="text-xs text-blue-400 font-medium">
                          {t("Analyzing document...")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
                        {reqState.thinking.slice(-500)}
                      </p>
                    </div>
                  )}

                  {/* Analysis result */}
                  {reqState?.compliance && (
                    <div
                      className={`rounded-md p-3 ${
                        reqState.compliance.status === "met"
                          ? "bg-green-500/10 border border-green-500/20"
                          : reqState.compliance.status === "warning"
                            ? "bg-yellow-500/10 border border-yellow-500/20"
                            : "bg-red-500/10 border border-red-500/20"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {reqState.compliance.status === "met" && (
                          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                        )}
                        {reqState.compliance.status === "warning" && (
                          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        )}
                        {reqState.compliance.status === "critical" && (
                          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <p
                            className={`text-sm font-medium ${
                              reqState.compliance.status === "met"
                                ? "text-green-400"
                                : reqState.compliance.status === "warning"
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            }`}
                          >
                            {reqState.compliance.status === "met" && t("Requirement satisfied")}
                            {reqState.compliance.status === "warning" && t("Partial / unclear")}
                            {reqState.compliance.status === "critical" && t("Issue detected")}
                          </p>
                          {reqState.compliance.detail && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {reqState.compliance.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cross-document findings */}
                  {reqState?.crossDocFindings && reqState.crossDocFindings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        {t("Cross-document findings:")}
                      </p>
                      {reqState.crossDocFindings.map((f, i) => (
                        <div
                          key={i}
                          className={`rounded-md p-2 text-sm ${
                            f.severity === "critical"
                              ? "bg-red-500/10 border border-red-500/20 text-red-300"
                              : f.severity === "warning"
                                ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
                                : "bg-blue-500/10 border border-blue-500/20 text-blue-300"
                          }`}
                        >
                          <p className="font-medium">{f.finding}</p>
                          {f.detail && (
                            <p className="text-xs mt-1 opacity-80">{f.detail}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload zone (expanded view — larger drop area) */}
                  {item.uploadable && status === "pending" && (
                    <div
                      className="mt-2 border-2 border-dashed border-border hover:border-blue-400 rounded-lg p-6 text-center cursor-pointer transition-colors"
                      onClick={() => handleBrowse(index)}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => handleDrop(index, e)}
                    >
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t("Drop your document here or")}{" "}
                        <span className="text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">{t("browse")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t("PNG or JPEG, max 5 MB")}</p>
                    </div>
                  )}

                  {/* Error state */}
                  {status === "error" && (
                    <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                      {t("Analysis failed. Please try uploading again.")}
                      <button
                        onClick={() => handleBrowse(index)}
                        className="ml-2 text-red-300 underline hover:text-red-200"
                      >
                        {t("Retry")}
                      </button>
                    </div>
                  )}

                  {/* External compliance (from batch analysis) */}
                  {externalStatus !== "not_checked" && compliance && !reqState?.compliance && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t("Source")}: </span>
                      <span
                        className={
                          externalStatus === "met"
                            ? "text-green-400"
                            : externalStatus === "warning"
                              ? "text-yellow-400"
                              : "text-red-400"
                        }
                      >
                        {externalStatus === "met" && t("Requirement satisfied")}
                        {externalStatus === "warning" && t("Partial / unclear")}
                        {externalStatus === "critical" && t("Issue detected")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator */}
        {isStreaming && (
          <div className="border border-dashed border-border rounded-lg px-4 py-6 flex items-center justify-center gap-3 text-muted-foreground animate-pulse">
            <div className="flex gap-1">
              <div
                className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-sm">{t("Loading next requirement...")}</span>
          </div>
        )}
      </div>

      {/* Bottom summary bar */}
      {totalRequirements > 0 && !isStreaming && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-4 pb-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {totalRequirements} {t("requirements")}
              {uploadableCount > 0 && ` (${uploadableCount} ${t("need documents")})`}
            </span>
            {analyzedCount > 0 && (
              <span className="text-foreground">
                {analyzedCount} {t("of")} {uploadableCount} {t("verified")}
              </span>
            )}
            {analyzedCount === 0 && uploadableCount > 0 && (
              <span className="text-blue-400 text-xs">
                {t("Upload documents to each requirement above")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Status icon component */
function StatusIcon({
  status,
  complianceStatus,
}: {
  status: RequirementStatus;
  complianceStatus: string;
}) {
  if (status === "passed" || complianceStatus === "met") {
    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  }
  if (status === "warning" || complianceStatus === "warning") {
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  }
  if (status === "flagged" || complianceStatus === "critical") {
    return <AlertCircle className="w-5 h-5 text-red-500" />;
  }
  if (status === "analyzing") {
    return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
  }
  if (status === "error") {
    return <AlertCircle className="w-5 h-5 text-red-500" />;
  }
  return <Circle className="w-5 h-5 text-muted-foreground" />;
}

/** Convert File to base64 string (without the data: prefix) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/xxx;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
