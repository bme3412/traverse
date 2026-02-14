"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, Info, ExternalLink, Globe, ChevronDown } from "lucide-react";
import { AdvisoryReport, ApplicationAssessment, DocumentExtraction, RemediationItem, FieldRegion, Severity } from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import { FadeText } from "./fade-text";
import { LANGUAGES } from "./language-selector";
import { FileText } from "lucide-react";

interface AdvisoryModalProps {
  advisory: AdvisoryReport;
  isOpen: boolean;
  onClose: () => void;
  documentImages?: Map<string, { base64: string; mimeType: string }>;
  extractions?: DocumentExtraction[];
}

/**
 * Converts text with URLs into JSX with clickable links
 */
function renderWithLinks(text: string) {
  // Match URLs (http/https)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1"
        >
          {part}
          <ExternalLink className="w-3 h-3 inline" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

/**
 * Gets assessment display info
 */
function getAssessmentInfo(overall: ApplicationAssessment) {
  switch (overall) {
    case "APPLICATION_PROCEEDS":
      return {
        icon: CheckCircle2,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/20",
        border: "border-emerald-200 dark:border-emerald-900",
        title: "Looking Good!",
        message: "Your application is on the right track. A few small improvements will make it even stronger.",
      };
    case "ADDITIONAL_DOCUMENTS_NEEDED":
      return {
        icon: AlertTriangle,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/20",
        border: "border-amber-200 dark:border-amber-900",
        title: "A Few Things to Fix",
        message: "We've found some items that need your attention before you submit.",
      };
    case "SIGNIFICANT_ISSUES":
      return {
        icon: AlertTriangle,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/20",
        border: "border-red-200 dark:border-red-900",
        title: "Let's Strengthen Your Application",
        message: "We've identified several important areas to address. Don't worry — we'll help you fix them.",
      };
  }
}

/**
 * Find the document image matching a fix's documentRef.
 * Tries exact match on docType, then fuzzy match.
 */
function findImageForFix(
  fix: RemediationItem,
  documentImages?: Map<string, { base64: string; mimeType: string }>
): { base64: string; mimeType: string } | null {
  if (!documentImages || documentImages.size === 0) return null;

  // Strategy 1: Match by documentRef if present
  if (fix.documentRef) {
    const ref = fix.documentRef.toLowerCase();

    // Exact match on docType key
    for (const [key, val] of documentImages) {
      if (key.toLowerCase() === ref) return val;
    }

    // Fuzzy: check if key contains ref or ref contains key
    for (const [key, val] of documentImages) {
      const k = key.toLowerCase();
      if (k.includes(ref) || ref.includes(k)) return val;
    }
  }

  // Strategy 2: Match by scanning fix issue/fix text for document type keywords
  const fixText = ((fix.issue || "") + " " + (fix.fix || "")).toLowerCase();
  const docTypeKeywords: Record<string, string[]> = {
    passport: ["passport"],
    invitation_letter: ["invitation", "invite"],
    bank_statement: ["bank", "statement", "balance", "funds", "financial"],
    employment_letter: ["employment", "employer", "salary", "job"],
    tax_return: ["tax", "itr", "income tax"],
    flight_booking: ["flight", "itinerary", "travel booking", "airline"],
    hotel_booking: ["hotel", "accommodation", "lodging", "booking"],
    insurance_policy: ["insurance", "travel insurance", "medical insurance"],
    cover_letter: ["cover letter"],
  };

  for (const [docType, keywords] of Object.entries(docTypeKeywords)) {
    if (keywords.some(kw => fixText.includes(kw))) {
      // Look for this docType in the image map
      for (const [key, val] of documentImages) {
        if (key.toLowerCase() === docType || key.toLowerCase().replace(/\s+/g, "_") === docType) {
          return val;
        }
      }
    }
  }

  return null;
}

/**
 * Find the extraction matching a fix's documentRef for structured data display.
 */
function findExtractionForFix(
  fix: RemediationItem,
  extractions?: DocumentExtraction[]
): DocumentExtraction | null {
  if (!extractions || extractions.length === 0) return null;

  // Strategy 1: Match by documentRef
  if (fix.documentRef) {
    const ref = fix.documentRef.toLowerCase();
    const match = extractions.find(
      (e) =>
        e.docType.toLowerCase() === ref ||
        e.docType.toLowerCase().includes(ref) ||
        ref.includes(e.docType.toLowerCase())
    );
    if (match) return match;
  }

  // Strategy 2: Match by keywords in fix text
  const fixText = ((fix.issue || "") + " " + (fix.fix || "")).toLowerCase();
  for (const e of extractions) {
    const docWords = e.docType.toLowerCase().replace(/_/g, " ").split(" ");
    if (docWords.some(w => w.length > 3 && fixText.includes(w))) {
      return e;
    }
  }

  return null;
}

/**
 * Find field regions from an extraction that match the text in a compliance detail/issue.
 */
function findRegionsForIssue(
  detail: string,
  fieldRegions: FieldRegion[]
): FieldRegion[] {
  const lowerDetail = detail.toLowerCase();
  return fieldRegions.filter(
    (fr) =>
      lowerDetail.includes(fr.value.toLowerCase()) ||
      lowerDetail.includes(fr.field.toLowerCase())
  );
}

/**
 * Severity-based highlight colors for grid overlays.
 */
const SEVERITY_HIGHLIGHT: Record<Severity, { border: string; bg: string; text: string }> = {
  critical: {
    border: "border-red-400 dark:border-red-500",
    bg: "bg-red-400/15 dark:bg-red-500/15",
    text: "bg-red-600 dark:bg-red-500 text-white",
  },
  warning: {
    border: "border-amber-400 dark:border-amber-500",
    bg: "bg-amber-400/15 dark:bg-amber-500/15",
    text: "bg-amber-600 dark:bg-amber-500 text-white",
  },
  info: {
    border: "border-blue-400 dark:border-blue-500",
    bg: "bg-blue-400/15 dark:bg-blue-500/15",
    text: "bg-blue-600 dark:bg-blue-500 text-white",
  },
};

/**
 * Renders a document thumbnail with optional region highlight overlays and structured data callout chips.
 */
function DocumentThumbnail({
  imageData,
  extraction,
  documentRef,
  issueText,
  severity,
}: {
  imageData: { base64: string; mimeType: string };
  extraction?: DocumentExtraction | null;
  documentRef?: string;
  issueText?: string;
  severity?: Severity;
}) {
  // Pick a few key fields from structuredData to show as chips
  const chips: Array<{ label: string; value: string }> = [];
  if (extraction?.structuredData) {
    const data = extraction.structuredData;
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === "string" && val.length < 60) {
        // Convert camelCase/snake_case to readable label
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/_/g, " ")
          .replace(/^\s/, "")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
        chips.push({ label, value: val });
      }
      if (chips.length >= 4) break; // Max 4 chips
    }
  }

  // Find matching field regions to highlight
  const highlights: FieldRegion[] =
    issueText && extraction?.fieldRegions
      ? findRegionsForIssue(issueText, extraction.fieldRegions)
      : [];
  const colors = SEVERITY_HIGHLIGHT[severity || "info"];

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
      {/* Document header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
        <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          {documentRef || extraction?.docType || "Document"}
        </span>
      </div>
      {/* Image with optional highlight overlays */}
      <div className="relative">
        <img
          src={`data:${imageData.mimeType};base64,${imageData.base64}`}
          alt={`Document: ${documentRef || "uploaded"}`}
          className="w-full max-h-56 object-contain bg-white dark:bg-slate-900 p-1"
        />
        {/* Region highlight overlays (3x3 grid) */}
        {highlights.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {highlights.map((h, i) => (
              <div
                key={i}
                className={`absolute border-2 rounded-sm ${colors.border} ${colors.bg} transition-opacity`}
                style={{
                  top: `${h.gridRow * 33.33}%`,
                  left: `${h.gridCol * 33.33}%`,
                  width: "33.33%",
                  height: "33.33%",
                }}
              >
                <span
                  className={`absolute top-0.5 left-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors.text} shadow-sm`}
                >
                  {h.field}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Structured data chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          {chips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
            >
              <span className="font-medium text-slate-500 dark:text-slate-400">{chip.label}:</span>
              <span>{chip.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdvisoryModal({ advisory, isOpen, onClose, documentImages, extractions }: AdvisoryModalProps) {
  // Debug: log document image matching info
  useEffect(() => {
    if (isOpen) {
      console.log(`[AdvisoryModal] Opened with ${documentImages?.size || 0} document images, ${extractions?.length || 0} extractions`);
      if (documentImages?.size) {
        console.log(`[AdvisoryModal] Image keys:`, Array.from(documentImages.keys()));
      }
      if (advisory?.fixes) {
        console.log(`[AdvisoryModal] Fix documentRefs:`, advisory.fixes.map(f => f.documentRef || '(none)'));
      }
    }
  }, [isOpen, documentImages, extractions, advisory]);

  const { t, language, setLanguage } = useTranslation();
  const [translatedContent, setTranslatedContent] = useState<{
    fixes: Array<{ issue: string; fix: string }>;
    interviewTips: string[];
    corridorWarnings: string[];
  } | null>(null);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const assessmentInfo = getAssessmentInfo(advisory.overall);
  const Icon = assessmentInfo.icon;

  // Get current language display name
  const currentLang = LANGUAGES.find(l => l.name === language) || LANGUAGES[0];

  // Translate advisory content when language changes
  useEffect(() => {
    if (!isOpen) return;

    // Skip translation if English
    if (language === "English") {
      setTranslatedContent(null);
      return;
    }

    // Helper to translate a batch of texts via the API
    async function translateBatch(texts: string[]): Promise<string[]> {
      if (texts.length === 0) return [];

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            dynamicTexts: texts,
          }),
        });

        if (!response.ok) return texts; // Fallback to original

        const data = await response.json();
        return data.dynamicTexts || texts;
      } catch {
        return texts; // Fallback on error
      }
    }

    // Collect all text to translate
    const textsToTranslate = [
      ...advisory.fixes.map((f) => f.issue),
      ...advisory.fixes.map((f) => f.fix),
      ...(advisory.interviewTips || []),
      ...(advisory.corridorWarnings || []),
    ];

    translateBatch(textsToTranslate).then((translated) => {
      const fixCount = advisory.fixes.length;
      const fixes = advisory.fixes.map((_, i) => ({
        issue: translated[i] || advisory.fixes[i].issue,
        fix: translated[fixCount + i] || advisory.fixes[i].fix,
      }));

      const tipStart = fixCount * 2;
      const tipCount = advisory.interviewTips?.length || 0;
      const interviewTips = (advisory.interviewTips || []).map(
        (_, i) => translated[tipStart + i] || advisory.interviewTips![i]
      );

      const warningStart = tipStart + tipCount;
      const corridorWarnings = (advisory.corridorWarnings || []).map(
        (_, i) => translated[warningStart + i] || advisory.corridorWarnings![i]
      );

      setTranslatedContent({ fixes, interviewTips, corridorWarnings });
    });
  }, [isOpen, advisory, language]);

  if (!isOpen) return null;

  const content = translatedContent || {
    fixes: advisory.fixes.map((f) => ({ issue: f.issue, fix: f.fix })),
    interviewTips: advisory.interviewTips || [],
    corridorWarnings: advisory.corridorWarnings || [],
  };

  // Group fixes by severity
  const critical = advisory.fixes.filter((f) => f.severity === "critical");
  const warnings = advisory.fixes.filter((f) => f.severity === "warning");
  const info = advisory.fixes.filter((f) => f.severity === "info");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 border-b ${assessmentInfo.border} ${assessmentInfo.bg}`}>
          <div className="flex items-start gap-4 p-6">
            <Icon className={`w-8 h-8 flex-shrink-0 ${assessmentInfo.color}`} />
            <div className="flex-1 min-w-0">
              <FadeText
                text={assessmentInfo.title}
                as="h2"
                className={`text-2xl font-bold ${assessmentInfo.color}`}
              />
              <FadeText
                text={assessmentInfo.message}
                as="p"
                className="mt-1 text-sm text-foreground/70"
              />
            </div>

            {/* Language Selector */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
                aria-label="Change language"
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">{currentLang.nativeName}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showLanguageMenu && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLanguageMenu(false)}
                  />

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLanguage(lang.name);
                          setShowLanguageMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${
                          lang.name === language ? "bg-slate-100 dark:bg-slate-700" : ""
                        }`}
                      >
                        <span className="text-sm font-medium text-foreground">
                          {lang.nativeName}
                        </span>
                        {lang.name === language && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
          {/* Critical Issues */}
          {critical.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="text-lg font-bold text-foreground">
                  <FadeText text={t("Must Fix These First")} />
                </h3>
              </div>
              <div className="space-y-4">
                {critical.map((fix, index) => {
                  const translatedFix = content.fixes[advisory.fixes.indexOf(fix)];
                  const matchingImage = findImageForFix(fix, documentImages);
                  const matchingExtraction = findExtractionForFix(fix, extractions);
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-red-600 dark:bg-red-500 text-white text-sm font-bold">
                          {fix.priority}
                        </span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="font-semibold text-foreground">
                            {renderWithLinks(translatedFix.issue)}
                          </div>
                          <div className="text-sm text-foreground/80 bg-white/60 dark:bg-slate-900/60 p-3 rounded border border-red-200/50 dark:border-red-900/50">
                            <span className="font-medium text-foreground/90">How to fix: </span>
                            {renderWithLinks(translatedFix.fix)}
                          </div>
                          {matchingImage && (
                            <DocumentThumbnail
                              imageData={matchingImage}
                              extraction={matchingExtraction}
                              documentRef={fix.documentRef}
                              issueText={fix.issue}
                              severity={fix.severity}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-bold text-foreground">
                  <FadeText text={t("Recommended Improvements")} />
                </h3>
              </div>
              <div className="space-y-4">
                {warnings.map((fix, index) => {
                  const translatedFix = content.fixes[advisory.fixes.indexOf(fix)];
                  const matchingImage = findImageForFix(fix, documentImages);
                  const matchingExtraction = findExtractionForFix(fix, extractions);
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 dark:bg-amber-500 text-white text-sm font-bold">
                          {fix.priority}
                        </span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="font-semibold text-foreground">
                            {renderWithLinks(translatedFix.issue)}
                          </div>
                          <div className="text-sm text-foreground/80 bg-white/60 dark:bg-slate-900/60 p-3 rounded border border-amber-200/50 dark:border-amber-900/50">
                            <span className="font-medium text-foreground/90">How to fix: </span>
                            {renderWithLinks(translatedFix.fix)}
                          </div>
                          {matchingImage && (
                            <DocumentThumbnail
                              imageData={matchingImage}
                              extraction={matchingExtraction}
                              documentRef={fix.documentRef}
                              issueText={fix.issue}
                              severity={fix.severity}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Info Items */}
          {info.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-foreground">
                  <FadeText text={t("Extra Tips to Strengthen Your Application")} />
                </h3>
              </div>
              <div className="space-y-4">
                {info.map((fix, index) => {
                  const translatedFix = content.fixes[advisory.fixes.indexOf(fix)];
                  const matchingImage = findImageForFix(fix, documentImages);
                  const matchingExtraction = findExtractionForFix(fix, extractions);
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-sm font-bold">
                          {fix.priority}
                        </span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="font-semibold text-foreground">
                            {renderWithLinks(translatedFix.issue)}
                          </div>
                          <div className="text-sm text-foreground/80 bg-white/60 dark:bg-slate-900/60 p-3 rounded border border-blue-200/50 dark:border-blue-900/50">
                            <span className="font-medium text-foreground/90">How to do it: </span>
                            {renderWithLinks(translatedFix.fix)}
                          </div>
                          {matchingImage && (
                            <DocumentThumbnail
                              imageData={matchingImage}
                              extraction={matchingExtraction}
                              documentRef={fix.documentRef}
                              issueText={fix.issue}
                              severity={fix.severity}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Interview Tips */}
          {content.interviewTips.length > 0 && (
            <section className="pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-lg font-bold text-foreground">
                  <FadeText text={t("Interview Preparation Tips")} />
                </h3>
              </div>
              <div className="space-y-3">
                {content.interviewTips.map((tip, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900"
                  >
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <p className="text-sm text-foreground/80">{renderWithLinks(tip)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Corridor Warnings */}
          {content.corridorWarnings.length > 0 && (
            <section className="pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-foreground">
                  <FadeText text={t("Important to Know")} />
                </h3>
              </div>
              <div className="space-y-3">
                {content.corridorWarnings.map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-900"
                  >
                    <Info className="w-5 h-5 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <p className="text-sm text-foreground/80">{renderWithLinks(warning)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <FadeText text={t("Take your time reviewing these suggestions. You've got this! 💪")} />
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              {t("Got it!")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
