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
  RequirementsChecklist,
} from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import { useDemoContext } from "@/lib/demo-context";
import { LANGUAGES } from "@/components/language-selector";
import {
  CheckCircle2,
  AlertCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  Info,
  DollarSign,
  Calendar,
  Eye,
} from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

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
  onPartialDocumentsAnalyzed?: (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => void;
  onDocumentImageCaptured?: (images: Map<string, { base64: string; mimeType: string }>) => void;
  isDemoProfile?: boolean;
  demoDocuments?: Array<{ name: string; language: string; image: string }>;
}

export function ProgressiveRequirements({
  events,
  isStreaming,
  compliance,
  corridorInfo,
  onAllDocumentsAnalyzed,
  onPartialDocumentsAnalyzed,
  onDocumentImageCaptured,
  isDemoProfile = false,
  demoDocuments = [],
}: ProgressiveRequirementsProps) {
  const { t, tDynamic, language, isTranslating, translatedRequirements, translatedCorridorInfo } = useTranslation();
  const { requestSidebarExpand } = useDemoContext();
  const sidebarExpandTriggeredRef = useRef(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [requirementStates, setRequirementStates] = useState<
    Map<number, RequirementState>
  >(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);
  const manualUploadCountRef = useRef(0);
  const manuallyUploadedIndicesRef = useRef<Set<number>>(new Set());
  const autoUploadTriggeredRef = useRef(false);
  const partialAdvisoryTriggeredRef = useRef(false);

  // Debug: Log props on mount and when they change
  useEffect(() => {
    console.log(`[ProgressiveRequirements] Props updated:`, {
      isDemoProfile,
      demoDocumentsLength: demoDocuments.length,
      demoDocuments: demoDocuments.map(d => d.name),
    });
  }, [isDemoProfile, demoDocuments]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  // Track all extractions for cross-document checking
  const extractionsRef = useRef<DocumentExtraction[]>([]);
  // Track document images (base64) keyed by docType for advisory annotation
  const documentImagesRef = useRef<Map<string, { base64: string; mimeType: string }>>(new Map());
  // Stable ref for the callback (avoids stale closure in handleFileUpload's useCallback)
  const onDocImageCapturedRef = useRef(onDocumentImageCaptured);
  useEffect(() => {
    onDocImageCapturedRef.current = onDocumentImageCaptured;
  }, [onDocumentImageCaptured]);

  // Clear drag-over state when drag ends anywhere (e.g. cancelled drop)
  useEffect(() => {
    const handleDragEnd = () => setDragOverIndex(null);
    document.addEventListener("dragend", handleDragEnd);
    return () => document.removeEventListener("dragend", handleDragEnd);
  }, []);

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

  // Build requirements list from SSE "requirement" events — only uploadable items
  const requirements = useMemo(() => {
    const all = events
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
    return all.filter((r) => r.uploadable);
  }, [events]);

  const totalRequirements = requirements.length;
  const analyzedCount = Array.from(requirementStates.values()).filter(
    (s) => s.status === "passed" || s.status === "warning" || s.status === "flagged"
  ).length;

  // Reset refs when requirements change (new analysis started)
  useEffect(() => {
    manualUploadCountRef.current = 0;
    manuallyUploadedIndicesRef.current.clear();
    autoUploadTriggeredRef.current = false;
    partialAdvisoryTriggeredRef.current = false;
    documentImagesRef.current.clear();
  }, [totalRequirements]);

  // EARLY TRIGGER: Start advisory after most documents analyzed (80-90%)
  // This provides parallel execution benefit while ensuring advisory has enough data to be accurate
  useEffect(() => {
    // Only trigger for demo profiles with many documents
    if (!isDemoProfile || totalRequirements < 6) return;
    if (partialAdvisoryTriggeredRef.current) return;

    // Wait for 80% of documents OR all but the last 1-2 documents (whichever is more)
    // For 9 docs: Math.max(7, 9-2) = 7 documents (waits for 7/9 = 78%)
    const eightyPercent = Math.floor(totalRequirements * 0.8);
    const allButTwo = totalRequirements - 2;
    const threshold = Math.max(eightyPercent, allButTwo);

    if (analyzedCount >= threshold && onPartialDocumentsAnalyzed) {
      console.log(`[Early Advisory] Triggering after ${analyzedCount}/${totalRequirements} documents (threshold: ${threshold})`);
      const partialExtractions = extractionsRef.current;
      const partialCompliances = Array.from(requirementStates.values())
        .filter((s) => s.compliance)
        .map((s) => s.compliance!);

      partialAdvisoryTriggeredRef.current = true;
      onPartialDocumentsAnalyzed(partialExtractions, partialCompliances);
      // Flush document images so they're available when the advisory modal opens early
      if (documentImagesRef.current.size > 0) {
        onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));
      }
    }
  }, [analyzedCount, totalRequirements, requirementStates, onPartialDocumentsAnalyzed, isDemoProfile]);

  // Check if all documents are analyzed — triggers advisory agent (fallback for non-demo)
  useEffect(() => {
    if (totalRequirements > 0 && analyzedCount === totalRequirements && onAllDocumentsAnalyzed) {
      const allExtractions = extractionsRef.current;
      const allCompliances = Array.from(requirementStates.values())
        .filter((s) => s.compliance)
        .map((s) => s.compliance!);
      onAllDocumentsAnalyzed(allExtractions, allCompliances);
      // Also flush final document images to ensure they're available for the advisory modal
      if (documentImagesRef.current.size > 0) {
        onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));
      }
    }
  }, [analyzedCount, totalRequirements, requirementStates, onAllDocumentsAnalyzed]);

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
    async (index: number, file: File): Promise<void> => {
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

      // Store base64 for advisory document annotation (keyed by requirement name initially)
      documentImagesRef.current.set(requirement.name, { base64, mimeType: file.type });
      onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));

      // Update state: uploaded → analyzing
      setRequirementStates((prev) => {
        const next = new Map(prev);
        next.set(index, { status: "analyzing", file, thinking: "Reading document..." });
        return next;
      });

      // Expand the item to show inline thinking
      setExpandedItems((prev) => new Set(prev).add(index));

      // Track manual uploads for demo auto-complete feature IMMEDIATELY on drop
      if (isDemoProfile && !autoUploadTriggeredRef.current) {
        manuallyUploadedIndicesRef.current.add(index);
        manualUploadCountRef.current += 1;
        console.log(`[Auto-upload] Manual upload count: ${manualUploadCountRef.current}, index: ${index}, isDemoProfile: ${isDemoProfile}, demoDocuments: ${demoDocuments.length}`);

        // After 2nd manual upload, auto-upload remaining docs immediately
        if (manualUploadCountRef.current === 2) {
          console.log(`[Auto-upload] Triggering auto-upload after 2nd document drop`);
          autoUploadTriggeredRef.current = true;
          // Trigger immediately - no need to wait
          setTimeout(() => autoUploadRemainingDocs(), 100);
        }
      }

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
                    // Also key the document image by docType for advisory annotation matching
                    const reqImageData = documentImagesRef.current.get(requirement.name);
                    if (reqImageData && event.extraction.docType) {
                      documentImagesRef.current.set(event.extraction.docType, reqImageData);
                      onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));
                    }
                  }

                  setRequirementStates((prev) => {
                    const next = new Map(prev);
                    const currentState = next.get(index);
                    next.set(index, {
                      status: newStatus,
                      file,
                      compliance: complianceResult,
                      crossDocFindings: event.crossDocFindings,
                      extraction: event.extraction,
                      thinking: currentState?.thinking, // Preserve thinking for transparency
                    });
                    return next;
                  });

                  // Auto-collapse clean passes after a brief delay
                  // Keep expanded if there are critical/warning cross-doc findings
                  if (complianceResult.status === "met") {
                    const hasIssues = event.crossDocFindings?.some(
                      (f: CrossDocFinding) => f.severity === "critical" || f.severity === "warning"
                    );
                    if (!hasIssues) {
                      setTimeout(() => {
                        setExpandedItems((prev) => {
                          const next = new Set(prev);
                          next.delete(index);
                          return next;
                        });
                      }, 2000);
                    }
                  }
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
    [requirements, isDemoProfile, demoDocuments]
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: autoUploadRemainingDocs intentionally omitted to avoid circular dependency
  );

  // Auto-upload remaining demo documents
  const autoUploadRemainingDocs = useCallback(async () => {
    console.log(`[Auto-upload] Starting auto-upload. isDemoProfile: ${isDemoProfile}, demoDocuments: ${demoDocuments.length}`);
    console.log(`[Auto-upload] Manually uploaded indices:`, Array.from(manuallyUploadedIndicesRef.current));

    if (!isDemoProfile || demoDocuments.length === 0) {
      console.log(`[Auto-upload] Skipping: isDemoProfile=${isDemoProfile}, demoDocuments.length=${demoDocuments.length}`);
      return;
    }

    // Find requirements that haven't been manually uploaded yet
    const unuploadedIndices: number[] = [];
    requirements.forEach((_req, index) => {
      // Skip if already manually uploaded
      if (!manuallyUploadedIndicesRef.current.has(index)) {
        unuploadedIndices.push(index);
      }
    });

    console.log(`[Auto-upload] Found ${unuploadedIndices.length} unuploaded requirements out of ${requirements.length} total`);
    console.log(`[Auto-upload] Unuploaded indices:`, unuploadedIndices);

    // For each unuploaded requirement, find matching demo document
    for (const index of unuploadedIndices) {
      const requirement = requirements[index];
      if (!requirement) continue;

      console.log(`[Auto-upload] Looking for match for requirement ${index}: "${requirement.name}"`);

      // Find matching demo document by name
      const demoDoc = demoDocuments.find(doc =>
        requirement.name.toLowerCase().includes(doc.name.toLowerCase()) ||
        doc.name.toLowerCase().includes(requirement.name.toLowerCase())
      );

      if (demoDoc) {
        console.log(`[Auto-upload] Found match: "${demoDoc.name}" for "${requirement.name}"`);
        try {
          // Fetch the image and convert to File
          const response = await fetch(demoDoc.image);
          const blob = await response.blob();
          const ext = demoDoc.image.split(".").pop() || "png";
          const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const filename = `${demoDoc.name.toLowerCase().replace(/[\s/]+/g, "-")}.${ext}`;
          const file = new File([blob], filename, { type: mimeType });

          // Trigger upload with small stagger delay to avoid overwhelming
          const delay = 300 * unuploadedIndices.indexOf(index);
          console.log(`[Auto-upload] Uploading "${demoDoc.name}" after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
          handleFileUpload(index, file);
        } catch (err) {
          console.error(`[Auto-upload] Failed to auto-upload ${demoDoc.name}:`, err);
        }
      } else {
        console.log(`[Auto-upload] No match found for requirement: "${requirement.name}"`);
      }
    }

    console.log(`[Auto-upload] Auto-upload complete`);
  }, [requirements, requirementStates, isDemoProfile, demoDocuments, handleFileUpload]);

  // Handle drag & drop for a requirement (supports both native files and demo sidebar docs)
  const handleDrop = useCallback(
    async (index: number, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverIndex(null);

      // Read data synchronously before any async ops (React recycles synthetic events)
      const demoData = e.dataTransfer.getData("application/x-demo-doc");
      const nativeFiles = e.dataTransfer.files;

      if (demoData) {
        try {
          const doc = JSON.parse(demoData);
          const response = await fetch(doc.image);
          const blob = await response.blob();
          const ext = doc.image.split(".").pop() || "png";
          const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const filename = `${doc.name.toLowerCase().replace(/[\s/]+/g, "-")}.${ext}`;
          const file = new File([blob], filename, { type: mimeType });
          handleFileUpload(index, file);
        } catch (err) {
          console.error("Failed to process demo document drop:", err);
        }
        return;
      }

      // Native file drop
      const file = nativeFiles[0];
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{t("Documents")}</h2>
            {totalRequirements > 0 && analyzedCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {analyzedCount}/{totalRequirements}
              </span>
            )}
          </div>
          {isTranslating && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t("Translating to")} {language}...</span>
            </div>
          )}
          {!isTranslating && isStreaming && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span>{t("Loading requirements…")}</span>
            </div>
          )}
        </div>

        {/* Progress bar — only shows once verification has started */}
        {analyzedCount > 0 && totalRequirements > 0 && (
          <div className="mt-2 w-full bg-secondary rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{
                width: `${(analyzedCount / totalRequirements) * 100}%`,
              }}
            />
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
                border rounded-lg overflow-hidden transition-all duration-200
                ${dragOverIndex === index
                  ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20 scale-[1.005]"
                  : status === "analyzing"
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
              onMouseEnter={() => {
                // On first hover of any requirement, expand the demo sidebar
                if (isDemoProfile && !sidebarExpandTriggeredRef.current) {
                  sidebarExpandTriggeredRef.current = true;
                  requestSidebarExpand();
                }
              }}
              onDragOver={(e) => {
                if (item.uploadable && status === "pending") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverIndex === index) setDragOverIndex(null);
                }
              }}
              onDrop={(e) => {
                if (item.uploadable && status === "pending") {
                  handleDrop(index, e);
                }
              }}
            >
              {/* Main requirement row — compact checklist style */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status Icon */}
                <button
                  onClick={() => toggleItem(index)}
                  className="flex-shrink-0 hover:opacity-80 transition-opacity"
                  title={`Toggle details for ${item.name}`}
                  aria-label={`Toggle details for ${item.name}`}
                >
                  <StatusIcon status={status} complianceStatus={statusFromCompliance} />
                </button>

                {/* Requirement Info — compact: number + name + one-line desc */}
                <button
                  onClick={() => toggleItem(index)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/60 tabular-nums shrink-0">{index + 1}.</span>
                    <p className={`font-medium text-foreground text-sm truncate ${isTranslating ? "opacity-50" : ""} transition-opacity`}>
                      {displayName}
                      {item.required && (
                        <span className="ml-1 text-red-400 text-xs">*</span>
                      )}
                      {item.universal && (
                        <span className="ml-1.5 text-blue-400 text-xs">({t("universal")})</span>
                      )}
                    </p>
                  </div>
                  {/* Description — single line, only shown when not expanded and not verified */}
                  {!isExpanded && status !== "passed" && (
                    <p className={`text-xs text-muted-foreground mt-0.5 ml-5 line-clamp-1 ${isTranslating ? "opacity-50" : ""} transition-opacity`}>
                      {displayDesc
                        ?.split(/\n|;/)
                        .map(s => s.trim())
                        .filter(s => !/^(Funds?:|Apply by:|Risk:|Duration:|Cost:|Processing|Fee:)/i.test(s))
                        .join(". ")
                        .replace(/\.\s*\./g, ".")
                        .trim() || displayDesc}
                    </p>
                  )}
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
                    <span>{reqState?.file?.name?.replace(/\.[^.]+$/, "") || "Document"}</span>
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
                  {/* Inline thinking panel — live during analysis */}
                  {reqState?.thinking && status === "analyzing" && (
                    <div className="rounded-md bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-blue-400 px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {t("Analyzing document...")}
                        </span>
                      </div>
                      <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1">
                        <FormatThinkingInline text={reqState.thinking.slice(-1200)} />
                      </div>
                    </div>
                  )}

                  {/* Persisted thinking — collapsible after analysis completes */}
                  {reqState?.thinking && status !== "analyzing" && (
                    <div className="rounded-md bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedThinking((prev) => {
                            const next = new Set(prev);
                            if (next.has(index)) {
                              next.delete(index);
                            } else {
                              next.add(index);
                            }
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span className="font-medium">{t("View AI reasoning")}</span>
                        {expandedThinking.has(index) ? (
                          <ChevronDown className="w-3 h-3 ml-auto" />
                        ) : (
                          <ChevronRight className="w-3 h-3 ml-auto" />
                        )}
                      </button>
                      {expandedThinking.has(index) && (
                        <div className="px-3 pb-3 text-[13px] text-muted-foreground leading-relaxed space-y-1 border-t border-slate-200 dark:border-slate-700 pt-2 max-h-96 overflow-y-auto">
                          <FormatThinkingInline text={reqState.thinking} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Analysis result — clean line, no background box */}
                  {reqState?.compliance && (
                    <div className="flex items-start gap-2.5 py-1">
                      {reqState.compliance.status === "met" && (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      )}
                      {reqState.compliance.status === "warning" && (
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      )}
                      {reqState.compliance.status === "critical" && (
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${
                          reqState.compliance.status === "met"
                            ? "text-green-700 dark:text-green-400"
                            : reqState.compliance.status === "warning"
                              ? "text-yellow-700 dark:text-yellow-400"
                              : "text-red-700 dark:text-red-400"
                        }`}>
                          {reqState.compliance.status === "met" && t("Requirement satisfied")}
                          {reqState.compliance.status === "warning" && t("Partial / unclear")}
                          {reqState.compliance.status === "critical" && t("Issue detected")}
                        </p>
                        {reqState.compliance.detail && (
                          <div className="mt-1">
                            <p className={`text-sm text-muted-foreground leading-relaxed ${
                              !expandedDetails.has(index) ? "line-clamp-2" : ""
                            }`}>
                              {reqState.compliance.detail}
                            </p>
                            {reqState.compliance.detail.length > 150 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedDetails(prev => {
                                    const next = new Set(prev);
                                    if (next.has(index)) next.delete(index);
                                    else next.add(index);
                                    return next;
                                  });
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 hover:underline"
                              >
                                {expandedDetails.has(index) ? t("Show less") : t("Show more")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cross-document findings — compact left-border list */}
                  {reqState?.crossDocFindings && reqState.crossDocFindings.length > 0 && (
                    <div className="mt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t("Cross-document checks")}
                        </p>
                        <CrossDocSummary findings={reqState.crossDocFindings} t={t} />
                      </div>
                      <div className="space-y-px">
                        {reqState.crossDocFindings.map((f, i) => {
                          const findingKey = `${index}-${i}`;
                          const isDetailOpen = expandedFindings.has(findingKey);
                          return (
                            <div key={i}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!f.detail) return;
                                  setExpandedFindings(prev => {
                                    const next = new Set(prev);
                                    if (next.has(findingKey)) next.delete(findingKey);
                                    else next.add(findingKey);
                                    return next;
                                  });
                                }}
                                className={`w-full text-left text-[13px] py-1.5 px-3 flex items-start gap-2 border-l-2 transition-colors ${
                                  f.detail ? "hover:bg-secondary/60 cursor-pointer" : "cursor-default"
                                } ${
                                  f.severity === "critical"
                                    ? "border-l-red-500"
                                    : f.severity === "warning"
                                      ? "border-l-yellow-500"
                                      : "border-l-green-500"
                                }`}
                              >
                                <span className={`flex-1 leading-snug ${
                                  f.severity === "critical"
                                    ? "text-red-700 dark:text-red-300 font-medium"
                                    : f.severity === "warning"
                                      ? "text-yellow-700 dark:text-yellow-300"
                                      : "text-foreground/70"
                                }`}>
                                  {f.finding}
                                </span>
                                {f.detail && (
                                  <ChevronDown className={`w-3 h-3 text-muted-foreground/50 flex-shrink-0 mt-0.5 transition-transform ${isDetailOpen ? "rotate-180" : ""}`} />
                                )}
                              </button>
                              {isDetailOpen && f.detail && (
                                <p className="text-xs text-muted-foreground px-3 pl-5 pb-2 leading-relaxed">
                                  {f.detail}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Source + metadata footer */}
                  {(item.source || item.uploadable) && (() => {
                    const sourceUrl = item.source ? sourceUrlMap.get(item.source) : undefined;
                    const resolvedUrl = sourceUrl
                      ? buildSourceUrlWithFragment(sourceUrl, item.name)
                      : undefined;
                    const hasIssue = status === "flagged" || status === "warning";

                    return (
                      <div className="pt-1 space-y-1.5">
                        {/* Prominent source link when there's an issue — only if we have a direct URL */}
                        {item.source && hasIssue && resolvedUrl && (
                          <a
                            href={resolvedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group"
                          >
                            <svg className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" viewBox="0 0 12 12" fill="none">
                              <path d="M4.5 2H2.5C1.95 2 1.5 2.45 1.5 3v6.5c0 .55.45 1 1 1H9c.55 0 1-.45 1-1V7.5M7 1.5h3.5m0 0V5m0-3.5L6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="underline decoration-blue-600/30 dark:decoration-blue-400/20 underline-offset-2 group-hover:decoration-blue-600/60">
                              {`${t("View requirement on")} ${item.source}`}
                            </span>
                          </a>
                        )}
                        {/* Quiet metadata row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.source && !hasIssue && (
                            <span className="text-[11px] text-muted-foreground">
                              {t("Source")}:{" "}
                              {resolvedUrl ? (
                                <a
                                  href={resolvedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 underline decoration-blue-600/20 underline-offset-2 hover:decoration-blue-600/50 dark:hover:decoration-blue-400/40 transition-colors"
                                >
                                  {item.source}
                                </a>
                              ) : (
                                <span>{item.source}</span>
                              )}
                            </span>
                          )}
                          {hasIssue && item.source && (
                            <span className="text-[11px] text-muted-foreground">{item.source}</span>
                          )}
                          <span className="text-[11px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground/70">
                            {t(`${item.confidence} confidence`)}
                          </span>
                          {item.uploadable && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground/70">
                              {t("document required")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

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

      {/* Bottom summary — only when verification is in progress */}
      {analyzedCount > 0 && totalRequirements > 0 && !isStreaming && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-3 pb-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {analyzedCount} {t("of")} {totalRequirements} {t("verified")}
            </span>
            {analyzedCount >= totalRequirements && (
              <span className="text-emerald-500 font-medium text-xs">
                {t("All documents verified")}
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

/**
 * Build a source URL with a text fragment for deep-linking.
 * Uses the Scroll to Text Fragment API (#:~:text=...) to highlight
 * the relevant section on the government source page.
 * Supported in Chrome, Edge, and other Chromium browsers.
 */
function buildSourceUrlWithFragment(baseUrl: string, requirementName: string): string {
  const stopWords = new Set(["a", "an", "the", "of", "for", "from", "or", "and", "with", "to", "in", "on", "at", "by", "is", "be"]);
  const terms = requirementName
    .toLowerCase()
    .replace(/[*()]/g, "")
    .split(/[\s/]+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 3);

  if (terms.length === 0) return baseUrl;

  const textFragment = encodeURIComponent(terms.join(" "));
  if (baseUrl.includes("#")) {
    return `${baseUrl}:~:text=${textFragment}`;
  }
  return `${baseUrl}#:~:text=${textFragment}`;
}

/** Lightweight formatter for inline thinking text — renders **bold**, lists, and line breaks */
function FormatThinkingInline({ text }: { text: string }) {
  const lines = text.split("\n");

  // Process **bold** markers within a line
  const renderBold = (line: string, lineIdx: number) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, j) =>
      j % 2 === 1
        ? <strong key={`${lineIdx}-${j}`} className="text-foreground/80 font-medium">{part}</strong>
        : <span key={`${lineIdx}-${j}`}>{part}</span>
    );
  };

  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === "") return null;

        // Numbered list items: "1. ", "2. ", etc.
        if (/^\d+\.\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground/50 flex-shrink-0 w-4 text-right">
                {trimmed.match(/^(\d+)\./)?.[1]}.
              </span>
              <span>{renderBold(trimmed.replace(/^\d+\.\s*/, ""), i)}</span>
            </div>
          );
        }

        // Bullet/dash items: "- " or "— "
        if (trimmed.startsWith("- ") || trimmed.startsWith("— ")) {
          return (
            <div key={i} className="pl-6">
              <span className="text-muted-foreground/40 mr-1.5">›</span>
              {renderBold(trimmed.replace(/^[-—]\s*/, ""), i)}
            </div>
          );
        }

        // Checkmark lines
        if (trimmed.endsWith("✓") || trimmed.endsWith("✔")) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="flex-1">{renderBold(trimmed.replace(/[✓✔]\s*$/, ""), i)}</span>
              <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0 mt-1" />
            </div>
          );
        }

        return <div key={i}>{renderBold(trimmed, i)}</div>;
      })}
    </>
  );
}

/** Cross-document findings severity summary — e.g. "3 consistent · 1 note" */
function CrossDocSummary({ findings, t }: { findings: CrossDocFinding[]; t: (s: string) => string }) {
  const counts = { info: 0, warning: 0, critical: 0 };
  findings.forEach(f => counts[f.severity]++);
  const parts: React.ReactElement[] = [];
  if (counts.info > 0) parts.push(
    <span key="info" className="text-green-600 dark:text-green-400">{counts.info} {t("consistent")}</span>
  );
  if (counts.warning > 0) parts.push(
    <span key="warn" className="text-yellow-600 dark:text-yellow-400">{counts.warning} {counts.warning === 1 ? t("note") : t("notes")}</span>
  );
  if (counts.critical > 0) parts.push(
    <span key="crit" className="text-red-600 dark:text-red-400">{counts.critical} {counts.critical === 1 ? t("issue") : t("issues")}</span>
  );
  return (
    <p className="text-xs">
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <span className="text-muted-foreground"> · </span>}{p}</span>
      ))}
    </p>
  );
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
