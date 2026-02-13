"use client";

/**
 * Requirements Checklist Component
 *
 * Displays the structured visa requirements returned by the Research Agent.
 * Checkboxes indicate compliance status (updated by Document Agent in Layer 4).
 */

import { RequirementsChecklist, ComplianceItem } from "@/lib/types";
import { CheckCircle2, AlertCircle, Circle, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n-context";

interface RequirementsChecklistProps {
  requirements: RequirementsChecklist;
  compliance?: ComplianceItem[]; // Added in Layer 4
}

export function RequirementsChecklistComponent({
  requirements,
  compliance,
}: RequirementsChecklistProps) {
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  // Get compliance status for a requirement
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
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Visa Requirements</h2>
          {!requirements.visaRequired && (
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
              Visa-Free
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{requirements.corridor}</p>
          <p>{requirements.visaType}</p>
        </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Required Documents</h3>
        <div className="space-y-2">
          {requirements.items.map((item, index) => {
            const status = getComplianceStatus(item.name);
            const isExpanded = expandedItems.has(index);

            return (
              <div
                key={index}
                className="border border-border rounded-lg overflow-hidden hover:border-border transition-colors"
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
                  <div className="px-4 pb-3 space-y-2 border-t border-border pt-3">
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
        </div>
      </div>

      {/* Fees and Logistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fees */}
        <div className="border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-foreground">Fees</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Visa fee:</span>
              <span className="text-foreground">{requirements.fees.visa}</span>
            </div>
            {requirements.fees.service && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service charge:</span>
                <span className="text-foreground">{requirements.fees.service}</span>
              </div>
            )}
          </div>
        </div>

        {/* Processing */}
        <div className="border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-foreground">Processing</h3>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Timeline: </span>
              <span className="text-foreground">{requirements.processingTime}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Apply at: </span>
              <span className="text-foreground">{requirements.applyAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      {requirements.importantNotes && requirements.importantNotes.length > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-400 mb-2">Important Notes</h3>
          <ul className="space-y-2 text-sm text-foreground">
            {requirements.importantNotes.map((note, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      {requirements.sources && requirements.sources.length > 0 && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-3">{t("Sources")}</h3>
          <div className="space-y-2">
            {requirements.sources.map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{source.name}</span>
                {source.dateAccessed && (
                  <span className="text-muted-foreground text-xs">
                    (accessed {source.dateAccessed})
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
