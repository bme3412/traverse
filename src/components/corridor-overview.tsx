"use client";

/**
 * Corridor Overview — enriched metadata display
 *
 * Renders a compact, information-dense card with corridor intelligence:
 * - Application window (earliest/latest)
 * - Financial thresholds
 * - Common rejection reasons
 * - Health requirements
 * - Alternative visa types
 * - Post-arrival registration
 * - Document language requirements
 * - Transit visa warnings
 *
 * Only renders sections that have data — fields are all optional.
 * Appears after requirements load, before the document upload zone.
 */

import { RequirementsChecklist } from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import {
  Calendar,
  DollarSign,
  AlertTriangle,
  Heart,
  ArrowRightLeft,
  MapPin,
  Languages,
  Plane,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import { useState } from "react";

interface CorridorOverviewProps {
  requirements: RequirementsChecklist;
}

export function CorridorOverview({ requirements }: CorridorOverviewProps) {
  const { t, tDynamic } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const {
    applicationWindow,
    commonRejectionReasons,
    healthRequirements,
    financialThresholds,
    alternativeVisaTypes,
    postArrivalRegistration,
    documentLanguage,
    transitVisaInfo,
    fees,
    processingTime,
  } = requirements;

  // Check if there's any enriched data to show
  const hasEnrichedData =
    applicationWindow ||
    (commonRejectionReasons && commonRejectionReasons.length > 0) ||
    (healthRequirements && healthRequirements.length > 0) ||
    financialThresholds ||
    (alternativeVisaTypes && alternativeVisaTypes.length > 0) ||
    postArrivalRegistration?.required ||
    documentLanguage ||
    transitVisaInfo;

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
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
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
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="ml-2 p-1 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded detail sections */}
      {expanded && (
        <div className="border-t border-border/60 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">

          {/* Transit Warning — full width, prominent */}
          {transitVisaInfo && (
            <div className="md:col-span-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex items-start gap-2">
              <Plane className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{t("Transit Warning")}</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">{tDynamic(transitVisaInfo.warning)}</p>
              </div>
            </div>
          )}

          {/* Application Window */}
          {applicationWindow && (
            <InfoSection
              icon={<Calendar className="w-3.5 h-3.5 text-blue-500" />}
              title={t("Application Window")}
            >
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Earliest")}</span>
                  <span className="text-foreground">{tDynamic(applicationWindow.earliest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Latest")}</span>
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
              <div className="space-y-1 text-xs">
                {financialThresholds.dailyMinimum && financialThresholds.dailyMinimum !== "N/A (lump-sum requirement)" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("Daily minimum")}</span>
                    <span className="text-foreground">{tDynamic(financialThresholds.dailyMinimum)}</span>
                  </div>
                )}
                {financialThresholds.totalRecommended && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("Recommended total")}</span>
                    <span className="text-foreground font-medium">{tDynamic(financialThresholds.totalRecommended)}</span>
                  </div>
                )}
                {financialThresholds.notes && (
                  <p className="text-muted-foreground mt-1 pt-1 border-t border-border/40">{tDynamic(financialThresholds.notes)}</p>
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
              <ul className="space-y-1">
                {commonRejectionReasons.map((reason, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                    {tDynamic(reason)}
                  </li>
                ))}
              </ul>
            </InfoSection>
          )}

          {/* Health Requirements */}
          {healthRequirements && healthRequirements.length > 0 && (
            <InfoSection
              icon={<Heart className="w-3.5 h-3.5 text-pink-500" />}
              title={t("Health Requirements")}
            >
              <div className="space-y-1.5">
                {healthRequirements.map((hr, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${hr.required ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="text-foreground font-medium">{tDynamic(hr.type)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${hr.required ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}`}>
                        {hr.required ? t("Required") : t("Recommended")}
                      </span>
                    </div>
                    {hr.note && <p className="text-muted-foreground ml-3 mt-0.5">{tDynamic(hr.note)}</p>}
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          {/* Alternative Visa Types */}
          {alternativeVisaTypes && alternativeVisaTypes.length > 0 && (
            <InfoSection
              icon={<ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" />}
              title={t("Alternative Visa Options")}
            >
              <div className="space-y-2">
                {alternativeVisaTypes.map((alt, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{tDynamic(alt.type)}</span>
                      {alt.processingTime && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">{tDynamic(alt.processingTime)}</span>
                      )}
                    </div>
                    {alt.note && <p className="text-muted-foreground mt-0.5">{tDynamic(alt.note)}</p>}
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          {/* Document Language */}
          {documentLanguage && (
            <InfoSection
              icon={<Languages className="w-3.5 h-3.5 text-cyan-500" />}
              title={t("Document Language")}
            >
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Accepted")}</span>
                  <span className="text-foreground">{documentLanguage.accepted.map(lang => tDynamic(lang)).join(", ")}</span>
                </div>
                {documentLanguage.translationRequired && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("Translation")}</span>
                    <span className="text-amber-500 dark:text-amber-400">
                      {documentLanguage.certifiedTranslation ? t("Certified translation required") : t("Translation required")}
                    </span>
                  </div>
                )}
              </div>
            </InfoSection>
          )}

          {/* Post-Arrival Registration */}
          {postArrivalRegistration?.required && (
            <InfoSection
              icon={<MapPin className="w-3.5 h-3.5 text-orange-500" />}
              title={t("Post-Arrival Registration")}
            >
              <div className="space-y-1 text-xs">
                {postArrivalRegistration.deadline && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("Deadline")}</span>
                    <span className="text-amber-500 dark:text-amber-400 font-medium">{tDynamic(postArrivalRegistration.deadline)}</span>
                  </div>
                )}
                {postArrivalRegistration.where && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground flex-shrink-0">{t("Where")}</span>
                    <span className="text-foreground text-right">{tDynamic(postArrivalRegistration.where)}</span>
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
 * Reusable section wrapper for the overview grid.
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
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
