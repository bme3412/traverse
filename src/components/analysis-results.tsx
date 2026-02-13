"use client";

/**
 * Analysis Results Component
 *
 * Displays document analysis results progressively as SSE events arrive.
 * Shows compliance, cross-lingual findings, forensic flags, and narrative assessment.
 * All visible text goes through t() for translation support.
 */

import { SSEEvent, DocumentAnalysis, ComplianceItem } from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import { CheckCircle2, AlertCircle, XCircle, FileText, Languages, Shield, FileCheck } from "lucide-react";
import { useMemo } from "react";

interface AnalysisResultsProps {
  events: SSEEvent[];
  analysis: DocumentAnalysis;
  isStreaming: boolean;
}

export function AnalysisResults({
  events,
  analysis,
  isStreaming,
}: AnalysisResultsProps) {
  const { t } = useTranslation();

  // Extract document read events
  const documentReads = useMemo(() => {
    return events
      .filter((e) => e.type === "document_read")
      .map((e) => {
        if (e.type === "document_read") {
          return {
            doc: e.doc,
            language: e.language,
            docType: e.docType as string | undefined,
          };
        }
        return null;
      })
      .filter(Boolean) as { doc: string; language: string; docType?: string }[];
  }, [events]);

  // Extract cross-lingual findings
  const crossLingualFindings = useMemo(() => {
    return events
      .filter((e) => e.type === "cross_lingual")
      .map((e) => {
        if (e.type === "cross_lingual") {
          return {
            finding: e.finding,
            severity: e.severity as string,
            details: e.details,
          };
        }
        return null;
      })
      .filter(Boolean) as { finding: string; severity: string; details?: string }[];
  }, [events]);

  // Extract forensic flags
  const forensicFlags = useMemo(() => {
    return events
      .filter((e) => e.type === "forensic")
      .map((e) => {
        if (e.type === "forensic") {
          return {
            finding: e.finding,
            severity: e.severity as string,
            details: e.details,
          };
        }
        return null;
      })
      .filter(Boolean) as { finding: string; severity: string; details?: string }[];
  }, [events]);

  // Extract narrative assessment
  const narrativeEvent = useMemo(() => {
    const event = events.find((e) => e.type === "narrative");
    if (event && event.type === "narrative") {
      return {
        assessment: event.assessment,
        issues: event.issues,
        details: event.details,
      };
    }
    return null;
  }, [events]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-400 border-red-500/30 bg-red-500/10";
      case "warning":
        return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
      case "info":
        return "text-blue-400 border-blue-500/30 bg-blue-500/10";
      default:
        return "text-muted-foreground border-border bg-muted/50";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case "info":
        return <CheckCircle2 className="w-5 h-5 text-blue-400" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="agent-output space-y-8">
      {/* Document Reads */}
      {documentReads.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">{t("Documents Read")}</h3>
            <span className="text-sm text-muted-foreground">({documentReads.length} {t("documents")})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documentReads.map((doc, index) => (
              <div
                key={index}
                className="border border-border rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in"
                style={{
                  animationDuration: '300ms',
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{doc.doc}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{doc.language}</span>
                    {doc.docType && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{doc.docType.replace(/_/g, " ")}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Summary */}
      {analysis.compliance && analysis.compliance.items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold">{t("Compliance Check")}</h3>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-green-500/30 bg-green-500/10 rounded-lg p-4">
              <div className="stat-number text-2xl font-bold text-green-400">{analysis.compliance.met}</div>
              <div className="text-sm text-muted-foreground">{t("Requirements Met")}</div>
            </div>
            <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-4">
              <div className="stat-number text-2xl font-bold text-yellow-400">{analysis.compliance.warnings}</div>
              <div className="text-sm text-muted-foreground">{t("Warnings")}</div>
            </div>
            <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4">
              <div className="stat-number text-2xl font-bold text-red-400">{analysis.compliance.critical}</div>
              <div className="text-sm text-muted-foreground">{t("Critical Issues")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Lingual Findings */}
      {crossLingualFindings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold">{t("Cross-Lingual Findings")}</h3>
            <span className="text-sm text-muted-foreground">({crossLingualFindings.length} {t("found")})</span>
          </div>

          <div className="space-y-3">
            {crossLingualFindings.map((finding, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in ${getSeverityColor(
                  finding.severity
                )}`}
                style={{
                  animationDuration: '300ms',
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {getSeverityIcon(finding.severity)}
                <div className="flex-1">
                  <p className="font-medium">{finding.finding}</p>
                  {finding.details && (
                    <p className="text-sm mt-2 opacity-80">{finding.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forensic Flags */}
      {forensicFlags.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold">{t("Forensic Flags")}</h3>
            <span className="text-sm text-muted-foreground">({forensicFlags.length} {t("found")})</span>
          </div>

          <div className="space-y-3">
            {forensicFlags.map((flag, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in ${getSeverityColor(
                  flag.severity
                )}`}
                style={{
                  animationDuration: '300ms',
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {getSeverityIcon(flag.severity)}
                <div className="flex-1">
                  <p className="font-medium">{flag.finding}</p>
                  {flag.details && (
                    <p className="text-sm mt-2 opacity-80">{flag.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative Assessment */}
      {narrativeEvent && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold">{t("Narrative Coherence")}</h3>
          </div>

          <div
            className={`border rounded-lg p-6 animate-in slide-in-from-bottom-2 fade-in ${
              narrativeEvent.assessment === "STRONG"
                ? "border-green-500/30 bg-green-500/10"
                : narrativeEvent.assessment === "WEAK"
                ? "border-red-500/30 bg-red-500/10"
                : "border-yellow-500/30 bg-yellow-500/10"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`text-3xl font-bold ${
                    narrativeEvent.assessment === "STRONG"
                      ? "text-green-400"
                      : narrativeEvent.assessment === "WEAK"
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}
                >
                  {narrativeEvent.assessment}
                </span>
                <div>
                  <div className="text-sm text-muted-foreground">{t("Overall narrative strength")}</div>
                  {narrativeEvent.issues > 0 && (
                    <div className="text-sm text-muted-foreground">{narrativeEvent.issues} {t("issues identified")}</div>
                  )}
                </div>
              </div>
            </div>

            {narrativeEvent.details && (
              <p className="text-foreground">{narrativeEvent.details}</p>
            )}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isStreaming && (
        <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-sm">{t("Analyzing documents...")}</span>
        </div>
      )}
    </div>
  );
}
