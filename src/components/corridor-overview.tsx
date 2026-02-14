"use client";

/**
 * Corridor Overview — enriched metadata display (simplified)
 *
 * Compact card with corridor intelligence:
 * - Application window (earliest/latest)
 * - Financial thresholds
 * - Common rejection reasons
 * - Document language requirements
 *
 * Only renders sections that have data — fields are all optional.
 * Defaults to collapsed — summary chips are sufficient at a glance.
 */

import { RequirementsChecklist } from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import {
  Calendar,
  DollarSign,
  AlertTriangle,
  Languages,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import React, { useState } from "react";

interface CorridorOverviewProps {
  requirements: RequirementsChecklist;
}

export function CorridorOverview({ requirements }: CorridorOverviewProps) {
  const { t, tDynamic } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const {
    applicationWindow,
    commonRejectionReasons,
    financialThresholds,
    documentLanguage,
    fees,
    processingTime,
  } = requirements;

  // Check if there's any enriched data to show
  const hasEnrichedData =
    applicationWindow ||
    (commonRejectionReasons && commonRejectionReasons.length > 0) ||
    financialThresholds ||
    documentLanguage;

  if (!hasEnrichedData) return null;

  // Top-level always-visible summary cards
  const summaryCards: { icon: React.ReactNode; label: string; value: string; accent?: string }[] = [];

  if (fees?.visa) {
    summaryCards.push({
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: t("Visa Fee"),
      value: tDynamic(fees.visa),
    });
  }

  if (processingTime) {
    summaryCards.push({
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: t("Processing"),
      value: tDynamic(processingTime),
    });
  }

  if (applicationWindow) {
    summaryCards.push({
      icon: <Calendar className="w-3.5 h-3.5" />,
      label: t("Apply"),
      value: tDynamic(applicationWindow.latest),
      accent: "text-amber-500 dark:text-amber-400",
    });
  }

  if (financialThresholds?.totalRecommended) {
    summaryCards.push({
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: t("Funds Needed"),
      value: tDynamic(financialThresholds.totalRecommended),
    });
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Summary row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Shield className="w-4 h-4 text-blue-500" />
          {t("Corridor Intelligence")}
        </div>
        <div className="flex-1" />
        {summaryCards.map((card, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={card.accent || ""}>{card.icon}</span>
            <span className="hidden sm:inline">{card.label}:</span>
            <span className={`font-medium ${card.accent || "text-foreground"}`}>{card.value}</span>
          </div>
        ))}
        <div className="ml-2 p-1 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded detail — single column, compact */}
      {expanded && (
        <div className="border-t border-border/60 px-4 py-4 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">

          {/* Application Window */}
          {applicationWindow && (
            <InfoSection
              icon={<Calendar className="w-3.5 h-3.5 text-blue-500" />}
              title={t("Application Window")}
            >
              <div className="flex gap-6 text-xs">
                <div>
                  <span className="text-muted-foreground">{t("Earliest")}:</span>{" "}
                  <span className="text-foreground">{tDynamic(applicationWindow.earliest)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("Latest")}:</span>{" "}
                  <span className="text-amber-500 dark:text-amber-400 font-medium">{tDynamic(applicationWindow.latest)}</span>
                </div>
              </div>
            </InfoSection>
          )}

          {/* Financial Thresholds */}
          {financialThresholds && (
            <InfoSection
              icon={<DollarSign className="w-3.5 h-3.5 text-green-500" />}
              title={t("Financial Requirements")}
            >
              <div className="text-xs space-y-1">
                <div className="flex gap-6 flex-wrap">
                  {financialThresholds.dailyMinimum && financialThresholds.dailyMinimum !== "N/A (lump-sum requirement)" && (
                    <div>
                      <span className="text-muted-foreground">{t("Daily minimum")}:</span>{" "}
                      <span className="text-foreground">{tDynamic(financialThresholds.dailyMinimum)}</span>
                    </div>
                  )}
                  {financialThresholds.totalRecommended && (
                    <div>
                      <span className="text-muted-foreground">{t("Recommended total")}:</span>{" "}
                      <span className="text-foreground font-medium">{tDynamic(financialThresholds.totalRecommended)}</span>
                    </div>
                  )}
                </div>
                {financialThresholds.notes && (
                  <p className="text-muted-foreground">{tDynamic(financialThresholds.notes)}</p>
                )}
              </div>
            </InfoSection>
          )}

          {/* Common Rejection Reasons */}
          {commonRejectionReasons && commonRejectionReasons.length > 0 && (
            <InfoSection
              icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              title={t("Common Rejection Reasons")}
            >
              <ul className="space-y-0.5">
                {commonRejectionReasons.map((reason, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                    {tDynamic(reason)}
                  </li>
                ))}
              </ul>
            </InfoSection>
          )}

          {/* Document Language */}
          {documentLanguage && (
            <InfoSection
              icon={<Languages className="w-3.5 h-3.5 text-cyan-500" />}
              title={t("Document Language")}
            >
              <div className="text-xs flex gap-6 flex-wrap">
                <div>
                  <span className="text-muted-foreground">{t("Accepted")}:</span>{" "}
                  <span className="text-foreground">{documentLanguage.accepted.map(lang => tDynamic(lang)).join(", ")}</span>
                </div>
                {documentLanguage.translationRequired && (
                  <div>
                    <span className="text-amber-500 dark:text-amber-400">
                      {documentLanguage.certifiedTranslation ? t("Certified translation required") : t("Translation required")}
                    </span>
                  </div>
                )}
              </div>
            </InfoSection>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Reusable section wrapper — single column layout.
 */
function InfoSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
