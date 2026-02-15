"use client";

/**
 * Internationalization Context
 *
 * Provides a t() function that translates UI strings into the selected language.
 * All translatable strings across the analyze page are defined here so they
 * can be sent to the Claude translation API in a single batch call.
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { TranslatedRequirement, RequirementsChecklist } from "./types";

// ============================================================
// All translatable UI strings — English defaults
// ============================================================

// ── Priority 1: Header, nav, status bar — translate first (visible at top) ──
export const UI_STRINGS_P1: Record<string, string> = {
  "Travel Requirements": "Travel Requirements",
  "Your personalized travel checklist for entering": "Your personalized travel checklist for entering",
  "from": "from",
  "Passport": "Passport",
  "Loading requirements\u2026": "Loading requirements\u2026",
  "traveler": "traveler",
  "travelers": "travelers",
  "tourism": "tourism",
  "business": "business",
  "education": "education",
  "medical": "medical",
  "other": "other",
  "Back to Home": "Back to Home",
  "New Check": "New Check",
  "Loading...": "Loading...",
  "Visa Requirements": "Visa Requirements",
  "Checking requirements...": "Checking requirements...",
  "All requirements loaded": "All requirements loaded",
  "requirements found": "requirements found",
  "documents checked": "documents checked",
  "Showing in": "Showing in",
  "Translating to": "Translating to",
  "Progress": "Progress",
  "Research": "Research",
  "Document Review": "Document Review",
  "Advisory": "Advisory",
  "Pending": "Pending",
  "Running": "Running",
  "Cached": "Cached",
  "Complete": "Complete",
  "Error": "Error",
  "Documents": "Documents",
  "Assessment": "Assessment",
  "Analyzing your travel corridor…": "Analyzing your travel corridor…",
  "Requirements identified": "Requirements identified",
  "Upload your first document": "Upload your first document",
  "Upload and verify your documents": "Upload and verify your documents",
  "All documents verified": "All documents verified",
  "Preparing your assessment…": "Preparing your assessment…",
  "Assessment ready": "Assessment ready",
  "Your assessment is ready": "Your assessment is ready",
  "View Assessment": "View Assessment",
};

// ── Priority 2: Requirements, live feed, document labels — translate second ──
export const UI_STRINGS_P2: Record<string, string> = {
  "Requirement": "Requirement",
  "universal": "universal",
  "Upload": "Upload",
  "Analyzing...": "Analyzing...",
  "Verified": "Verified",
  "Warning": "Warning",
  "Issue Found": "Issue Found",
  "Info only": "Info only",
  "Source": "Source",
  "Sources": "Sources",
  "Data grounded from": "Data grounded from",
  "accessed": "accessed",
  "high confidence": "high confidence",
  "medium confidence": "medium confidence",
  "low confidence": "low confidence",
  "document required": "document required",
  "Analyzing document...": "Analyzing document...",
  "Reading document...": "Reading document...",
  "Requirement satisfied": "Requirement satisfied",
  "Partial / unclear": "Partial / unclear",
  "Issue detected": "Issue detected",
  "Cross-document findings:": "Cross-document findings:",
  "Drop your document here or": "Drop your document here or",
  "browse": "browse",
  "PNG or JPEG, max 5 MB": "PNG or JPEG, max 5 MB",
  "Analysis failed. Please try uploading again.": "Analysis failed. Please try uploading again.",
  "Retry": "Retry",
  "Loading next requirement...": "Loading next requirement...",
  "requirements": "requirements",
  "need documents": "need documents",
  "verified": "verified",
  "of": "of",
  "Upload documents to each requirement above": "Upload documents to each requirement above",
  "Narrative": "Narrative",
  "Coherence:": "Coherence:",
  "issue": "issue",
  "issues": "issues",
  "Overall Assessment": "Overall Assessment",
  "Document Analysis": "Document Analysis",
  "Verifying compliance and checking for potential issues.": "Verifying compliance and checking for potential issues.",
  "Documents Read": "Documents Read",
  "documents": "documents",
  "Compliance Check": "Compliance Check",
  "Requirements Met": "Requirements Met",
  "Warnings": "Warnings",
  "Critical Issues": "Critical Issues",
  "Cross-Lingual Findings": "Cross-Lingual Findings",
  "found": "found",
  "Forensic Flags": "Forensic Flags",
  "Narrative Coherence": "Narrative Coherence",
  "Overall narrative strength": "Overall narrative strength",
  "issues identified": "issues identified",
  "Analyzing documents...": "Analyzing documents...",
  "Upload Your Documents": "Upload Your Documents",
  "Or upload all documents at once for batch analysis.": "Or upload all documents at once for batch analysis.",
  "Drop your documents here, or click to browse": "Drop your documents here, or click to browse",
  "files uploaded": "files uploaded",
  "Uploaded Documents": "Uploaded Documents",
  "Analyzing Documents...": "Analyzing Documents...",
  "Analyze": "Analyze",
  "Document": "Document",
  "Documents": "Documents",
  // Corridor details
  "Visa Fee": "Visa Fee",
  "Processing": "Processing",
  "Apply": "Apply",
  "Funds": "Funds",
  "Funds Needed": "Funds Needed",
  "Language": "Language",
  "total": "total",
  "early": "early",
  "certified translation required": "certified translation required",
  "translation required": "translation required",
  "Transit Warning": "Transit Warning",
  "Common Rejection Reasons": "Common Rejection Reasons",
  "Health Requirements": "Health Requirements",
  "Required": "Required",
  "Recommended": "Recommended",
  "Alternative Visa Options": "Alternative Visa Options",
  "Post-Arrival Registration": "Post-Arrival Registration",
  "Deadline": "Deadline",
  "Where": "Where",
};

// Combined — for components that need the full list
export const UI_STRINGS: Record<string, string> = { ...UI_STRINGS_P1, ...UI_STRINGS_P2 };

// ============================================================
// Corridor Dynamic Text Collection
// ============================================================

/**
 * Extracts all translatable dynamic strings from a RequirementsChecklist.
 * These are values displayed in the CorridorOverview component via tDynamic().
 * Exported so the analyze page effect can also use it.
 */
export function collectCorridorDynamicTexts(req: RequirementsChecklist): string[] {
  const texts: string[] = [];

  if (req.fees?.visa) texts.push(req.fees.visa);
  if (req.fees?.service) texts.push(req.fees.service);
  if (req.processingTime) texts.push(req.processingTime);
  if (req.applyAt) texts.push(req.applyAt);

  if (req.applicationWindow) {
    if (req.applicationWindow.earliest) texts.push(req.applicationWindow.earliest);
    if (req.applicationWindow.latest) texts.push(req.applicationWindow.latest);
  }

  if (req.financialThresholds) {
    if (req.financialThresholds.dailyMinimum) texts.push(req.financialThresholds.dailyMinimum);
    if (req.financialThresholds.totalRecommended) texts.push(req.financialThresholds.totalRecommended);
    if (req.financialThresholds.notes) texts.push(req.financialThresholds.notes);
  }

  if (req.commonRejectionReasons) {
    texts.push(...req.commonRejectionReasons);
  }

  if (req.healthRequirements) {
    for (const hr of req.healthRequirements) {
      if (hr.type) texts.push(hr.type);
      if (hr.note) texts.push(hr.note);
    }
  }

  if (req.alternativeVisaTypes) {
    for (const alt of req.alternativeVisaTypes) {
      if (alt.type) texts.push(alt.type);
      if (alt.processingTime) texts.push(alt.processingTime);
      if (alt.note) texts.push(alt.note);
    }
  }

  if (req.documentLanguage?.accepted) {
    texts.push(...req.documentLanguage.accepted);
  }

  if (req.transitVisaInfo) {
    if (req.transitVisaInfo.warning) texts.push(req.transitVisaInfo.warning);
    if (req.transitVisaInfo.applies) texts.push(req.transitVisaInfo.applies);
  }

  if (req.postArrivalRegistration) {
    if (req.postArrivalRegistration.deadline) texts.push(req.postArrivalRegistration.deadline);
    if (req.postArrivalRegistration.where) texts.push(req.postArrivalRegistration.where);
  }

  if (req.importantNotes) {
    texts.push(...req.importantNotes);
  }

  return texts.filter(Boolean);
}

// ============================================================
// Translation Context
// ============================================================

interface TranslationContextValue {
  /** Translate a UI string. Falls back to the English input if no translation exists. */
  t: (englishText: string) => string;
  /** Translate dynamic content (feed text, thinking panel). Same fallback as t(). */
  tDynamic: (englishText: string) => string;
  /** Current output language */
  language: string;
  /** Whether a translation is in progress */
  isTranslating: boolean;
  /** Current translation phase for progress display */
  translationPhase: "ui" | "requirements" | "content" | "complete" | null;
  /** Change language and trigger translation */
  setLanguage: (language: string) => void;
  /** Translated requirements keyed by original English name */
  translatedRequirements: Map<string, TranslatedRequirement>;
  /** Translated corridor info */
  translatedCorridorInfo: { corridor: string; visaType: string } | null;
  /** Translate a batch of dynamic texts from the live feed. Call after research completes. */
  translateFeedContent: (texts: string[]) => Promise<void>;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface TranslationProviderProps {
  children: ReactNode;
  /** Current SSE events — used to extract requirements for translation */
  getRequirementItems?: () => { name: string; description: string }[];
  /** Collect dynamic texts from the live feed for translation */
  getFeedTexts?: () => string[];
  /** Current corridor info */
  corridorInfo?: { corridor: string; visaType: string } | null;
  /** Suggested language from persona */
  suggestedLanguage?: string;
  /** Get full requirements result for corridor dynamic text translation */
  getRequirementsResult?: () => RequirementsChecklist | null;
}

export function TranslationProvider({
  children,
  getRequirementItems,
  getFeedTexts,
  corridorInfo,
  getRequirementsResult,
}: TranslationProviderProps) {
  const [language, setLanguageState] = useState("English");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationPhase, setTranslationPhase] = useState<"ui" | "requirements" | "content" | "complete" | null>(null);
  const [uiTranslations, setUiTranslations] = useState<Map<string, string>>(new Map());
  const [dynamicTranslations, setDynamicTranslations] = useState<Map<string, string>>(new Map());
  const [translatedRequirements, setTranslatedRequirements] = useState<Map<string, TranslatedRequirement>>(new Map());
  const [translatedCorridorInfo, setTranslatedCorridorInfo] = useState<{ corridor: string; visaType: string } | null>(null);
  // Track which dynamic texts we've already translated to avoid re-translating
  const translatedDynamicKeys = useRef<Set<string>>(new Set());

  const t = useCallback(
    (englishText: string): string => {
      if (language === "English") return englishText;
      return uiTranslations.get(englishText) || englishText;
    },
    [language, uiTranslations]
  );

  const tDynamic = useCallback(
    (englishText: string): string => {
      if (language === "English") return englishText;
      return dynamicTranslations.get(englishText) || englishText;
    },
    [language, dynamicTranslations]
  );

  /** Parse translated UI strings from API response into the map */
  const applyUiTranslations = useCallback((data: Record<string, unknown>, existingMap?: Map<string, string>) => {
    if (!data.uiStrings) return existingMap || new Map<string, string>();
    const newMap = new Map<string, string>(existingMap || []);
    for (const [key, value] of Object.entries(data.uiStrings as Record<string, string>)) {
      if (typeof value === "string" && value !== key) {
        newMap.set(key, value);
      }
    }
    return newMap;
  }, []);

  /**
   * Apply an array of translated texts to the dynamic translations map.
   */
  const applyDynamicTranslations = useCallback(
    (originals: string[], translated: string[]) => {
      setDynamicTranslations((prev) => {
        const newMap = new Map(prev);
        for (let i = 0; i < originals.length; i++) {
          const t = translated[i];
          if (t && t !== originals[i]) {
            newMap.set(originals[i], t);
            translatedDynamicKeys.current.add(originals[i]);
          }
        }
        return newMap;
      });
    },
    []
  );

  /**
   * Send a single batch of dynamic texts to the translate API.
   */
  const sendDynamicBatch = useCallback(
    async (targetLanguage: string, texts: string[]) => {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: targetLanguage,
          dynamicTexts: texts,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.dynamicTexts && Array.isArray(data.dynamicTexts)) {
          applyDynamicTranslations(texts, data.dynamicTexts);
        }
      }
    },
    [applyDynamicTranslations]
  );

  /**
   * Translate a batch of dynamic texts (Phase 3).
   * Splits long texts (thinking excerpts) into a separate API call
   * so shorter items (corridor values, recommendations) translate quickly.
   * Used by setLanguage and also callable externally (when research completes).
   */
  const translateDynamicBatch = useCallback(
    async (targetLanguage: string, texts: string[]) => {
      // Filter out texts we've already translated
      const newTexts = texts.filter((txt) => txt && !translatedDynamicKeys.current.has(txt));
      if (newTexts.length === 0) return;

      // Split into short texts (corridor values, summaries) and long texts (thinking excerpts)
      const SHORT_THRESHOLD = 500;
      const shortTexts = newTexts.filter((t) => t.length <= SHORT_THRESHOLD);
      const longTexts = newTexts.filter((t) => t.length > SHORT_THRESHOLD);

      try {
        // Translate short texts first (fast), then long texts in parallel
        const promises: Promise<void>[] = [];
        if (shortTexts.length > 0) {
          promises.push(sendDynamicBatch(targetLanguage, shortTexts));
        }
        if (longTexts.length > 0) {
          promises.push(sendDynamicBatch(targetLanguage, longTexts));
        }
        await Promise.all(promises);
      } catch (error) {
        console.error("Dynamic translation failed:", error);
      }
    },
    []
  );

  const setLanguage = useCallback(
    async (newLanguage: string) => {
      setLanguageState(newLanguage);

      // Reset to English — instant, no API call
      if (newLanguage === "English") {
        setUiTranslations(new Map());
        setDynamicTranslations(new Map());
        setTranslatedRequirements(new Map());
        setTranslatedCorridorInfo(null);
        setTranslationPhase(null);
        translatedDynamicKeys.current.clear();
        return;
      }

      setIsTranslating(true);
      setTranslationPhase("ui");

      // Get requirements data early — used for corridor dynamic texts in P3
      const reqResult = getRequirementsResult?.() || null;

      // ── Phase 1: Translate header/nav/status strings (small, fast) ──
      // This returns quickly so the top of the page updates first.
      let p1Map = new Map<string, string>();
      try {
        const p1Response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: newLanguage,
            uiStrings: UI_STRINGS_P1,
            corridorInfo: corridorInfo || undefined,
          }),
        });

        if (p1Response.ok) {
          const p1Data = await p1Response.json();
          p1Map = applyUiTranslations(p1Data);
          setUiTranslations(p1Map);
          // Corridor info often comes with phase 1
          if (p1Data.corridorInfo) {
            setTranslatedCorridorInfo(p1Data.corridorInfo);
          }
        }
      } catch (error) {
        console.error("Phase 1 translation failed:", error);
      }

      // ── Phase 2: Requirements + remaining UI strings (heavier) ──
      // Also retry any P1 strings that weren't translated (Claude sometimes
      // drops keys from large batches).
      setTranslationPhase("requirements");
      const items = getRequirementItems?.() || [];

      // Identify P1 strings that weren't translated and retry them in P2
      const missingP1: Record<string, string> = {};
      for (const key of Object.keys(UI_STRINGS_P1)) {
        if (!p1Map.has(key)) {
          missingP1[key] = UI_STRINGS_P1[key];
        }
      }
      const p2UiStrings = Object.keys(missingP1).length > 0
        ? { ...UI_STRINGS_P2, ...missingP1 }
        : UI_STRINGS_P2;

      try {
        const p2Response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: newLanguage,
            uiStrings: p2UiStrings,
            items: items.length > 0 ? items : undefined,
          }),
        });

        if (p2Response.ok) {
          const p2Data = await p2Response.json();

          // Merge P2 UI strings (including retried P1 strings) with existing
          setUiTranslations((prev) => applyUiTranslations(p2Data, prev));

          // Store requirement translations
          if (p2Data.items && items.length > 0) {
            const newReqs = new Map<string, TranslatedRequirement>();
            for (let i = 0; i < p2Data.items.length; i++) {
              const original = items[i];
              const translated = p2Data.items[i];
              if (original && translated) {
                newReqs.set(original.name, {
                  name: translated.name,
                  description: translated.description,
                });
              }
            }
            setTranslatedRequirements(newReqs);
          }
        }
      } catch (error) {
        console.error("Phase 2 translation failed:", error);
      }

      // ── Phase 3: Translate live feed + corridor dynamic content ──
      // Status updates, thinking summaries, corridor overview values
      // (fees, processing time, financial thresholds, rejection reasons, etc.)
      setTranslationPhase("content");
      const feedTexts = getFeedTexts?.() || [];
      const corridorDynamicTexts = reqResult ? collectCorridorDynamicTexts(reqResult) : [];
      const allPhase3Texts = [...feedTexts, ...corridorDynamicTexts];
      if (allPhase3Texts.length > 0) {
        await translateDynamicBatch(newLanguage, allPhase3Texts);
      }

      setTranslationPhase("complete");
      setIsTranslating(false);

      // Auto-hide complete message after 2 seconds
      setTimeout(() => {
        setTranslationPhase(null);
      }, 2000);
    },
    [getRequirementItems, getFeedTexts, corridorInfo, getRequirementsResult, applyUiTranslations, translateDynamicBatch]
  );

  /**
   * Public method: translate feed content on demand.
   * Called by the analyze page when research completes.
   */
  const translateFeedContent = useCallback(
    async (texts: string[]) => {
      if (language === "English" || texts.length === 0) return;
      setIsTranslating(true);
      setTranslationPhase("content");
      await translateDynamicBatch(language, texts);
      setTranslationPhase("complete");
      setIsTranslating(false);
      // Auto-hide complete message after 2 seconds
      setTimeout(() => {
        setTranslationPhase(null);
      }, 2000);
    },
    [language, translateDynamicBatch]
  );

  return (
    <TranslationContext.Provider
      value={{
        t,
        tDynamic,
        language,
        isTranslating,
        translationPhase,
        setLanguage,
        translatedRequirements,
        translatedCorridorInfo,
        translateFeedContent,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useTranslation() {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    // Fallback for components outside the provider — returns English passthrough
    return {
      t: (text: string) => text,
      tDynamic: (text: string) => text,
      language: "English",
      isTranslating: false,
      translationPhase: null as "ui" | "requirements" | "content" | "complete" | null,
      setLanguage: () => {},
      translatedRequirements: new Map<string, TranslatedRequirement>(),
      translatedCorridorInfo: null,
      translateFeedContent: async () => {},
    };
  }
  return ctx;
}
