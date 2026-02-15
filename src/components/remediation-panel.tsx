"use client";

/**
 * Remediation Panel — shows before/after document cards for each fix
 * and a CTA to apply fixes and re-audit.
 */

import { useState } from "react";
import {
  AlertTriangle,
  XCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileCheck2,
  RefreshCw,
  ZoomIn,
  X,
  FilePlus2,
} from "lucide-react";
import type { RemediationFix, PersonaRemediation } from "@/lib/remediation-data";

interface RemediationPanelProps {
  remediation: PersonaRemediation;
  onApplyFixes: () => void;
  isReauditing: boolean;
}

export function RemediationPanel({ remediation, onApplyFixes, isReauditing }: RemediationPanelProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [zoomedImage, setZoomedImage] = useState<{ src: string; label: string } | null>(null);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const criticalCount = remediation.fixes.filter((f) => f.severity === "critical").length;
  const warningCount = remediation.fixes.filter((f) => f.severity === "warning").length;

  return (
    <>
      <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="rounded-t-xl border border-border/60 bg-gradient-to-r from-amber-500/5 via-transparent to-red-500/5 dark:from-amber-950/20 dark:to-red-950/20 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Fix Wizard — {remediation.fixes.length} Issues to Resolve
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ve identified the specific changes needed to bring {remediation.personaName.split(" ")[0]}&apos;s documents into compliance.
                Review each fix below, then apply them all for a re-audit.
              </p>
              <div className="flex items-center gap-3 mt-3">
                {criticalCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {warningCount} warning
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fix Cards */}
        <div className="border-x border-border/60 divide-y divide-border/40">
          {remediation.fixes.map((fix, i) => (
            <FixCard
              key={fix.id}
              fix={fix}
              index={i}
              isExpanded={expandedCards.has(fix.id)}
              onToggle={() => toggleCard(fix.id)}
              onZoom={(src, label) => setZoomedImage({ src, label })}
            />
          ))}
        </div>

        {/* CTA Footer */}
        <div className="rounded-b-xl border border-t-0 border-border/60 bg-gradient-to-r from-emerald-500/5 to-blue-500/5 dark:from-emerald-950/20 dark:to-blue-950/20 px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileCheck2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-foreground">Ready to apply corrections</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Corrected documents will replace the originals and go through a fresh audit.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onApplyFixes}
              disabled={isReauditing}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
            >
              {isReauditing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Re-auditing…
                </>
              ) : (
                <>
                  Apply Fixes & Re-check
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Zoomed Image Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center">
            <div className="w-full flex items-center justify-between px-4 py-2.5 mb-2">
              <p className="text-sm font-medium text-white/90">{zoomedImage.label}</p>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                aria-label="Close zoom"
                className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              className="overflow-auto max-h-[calc(92vh-3rem)] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedImage.src}
                alt={zoomedImage.label}
                className="w-full cursor-default"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Fix Card sub-component
// ============================================================

function FixCard({
  fix,
  index,
  isExpanded,
  onToggle,
  onZoom,
}: {
  fix: RemediationFix;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onZoom: (src: string, label: string) => void;
}) {
  const isCritical = fix.severity === "critical";

  return (
    <div className="bg-card/50">
      {/* Collapsed summary */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-secondary/30 transition-colors"
      >
        {/* Severity badge */}
        <span
          className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
            isCritical
              ? "bg-red-500/15 text-red-600 dark:text-red-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}
        >
          {index + 1}
        </span>

        {/* Title + brief */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                isCritical
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {fix.severity}
            </span>
            {fix.isNewDocument && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                <FilePlus2 className="w-3 h-3" />
                New Document
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{fix.issueTitle}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{fix.requirementName}</p>
        </div>

        {/* Expand chevron */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-6 pb-5 animate-in fade-in duration-300">
          {/* Issue explanation */}
          <div
            className={`rounded-lg border px-4 py-3 mb-4 ${
              isCritical
                ? "border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5"
                : "border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5"
            }`}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Issue</p>
            <p className="text-sm text-foreground leading-relaxed">{fix.issueDetail}</p>
          </div>

          {/* Fix explanation */}
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 px-4 py-3 mb-5">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Fix Applied</p>
            <p className="text-sm text-foreground leading-relaxed">{fix.fixDetail}</p>
          </div>

          {/* Before / After document images */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Before */}
            <div className="rounded-lg border border-red-200 dark:border-red-500/20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-500/5 border-b border-red-200 dark:border-red-500/20">
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  {fix.isNewDocument ? "Missing" : "Before"}
                </span>
              </div>
              <div className="relative group bg-secondary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fix.originalDocImage}
                  alt={`Original: ${fix.requirementName}`}
                  className="w-full max-h-60 object-contain object-top"
                />
                <div className="absolute inset-0 bg-red-500/5" />
                <button
                  type="button"
                  onClick={() => onZoom(fix.originalDocImage, `Original: ${fix.requirementName}`)}
                  className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 hover:bg-black/80 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                >
                  <ZoomIn className="w-3 h-3" />
                  Zoom
                </button>
              </div>
            </div>

            {/* After */}
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-500/5 border-b border-emerald-200 dark:border-emerald-500/20">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  {fix.isNewDocument ? "New Document" : "After"}
                </span>
              </div>
              <div className="relative group bg-secondary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fix.correctedDocImage}
                  alt={`Corrected: ${fix.requirementName}`}
                  className="w-full max-h-60 object-contain object-top"
                />
                <div className="absolute inset-0 bg-emerald-500/5" />
                <button
                  type="button"
                  onClick={() => onZoom(fix.correctedDocImage, `Corrected: ${fix.requirementName}`)}
                  className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 hover:bg-black/80 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                >
                  <ZoomIn className="w-3 h-3" />
                  Zoom
                </button>
              </div>
            </div>
          </div>

          {/* Change annotations table */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="px-3 py-2 bg-secondary/40 border-b border-border/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Changes Made
              </p>
            </div>
            <div className="divide-y divide-border/30">
              {fix.changes.map((change, ci) => (
                <div key={ci} className="grid grid-cols-[140px_1fr_auto_1fr] items-center gap-2 px-3 py-2.5 text-xs">
                  <span className="font-medium text-muted-foreground truncate" title={change.field}>
                    {change.field}
                  </span>
                  <span className="text-red-600 dark:text-red-400 line-through opacity-70 truncate" title={change.original}>
                    {change.original}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate" title={change.corrected}>
                    {change.corrected}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
