"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSSE } from "@/hooks/use-sse";
import { LiveFeed } from "@/components/live-feed";
import { AgentStatusBar } from "@/components/agent-status";
import { ProgressiveRequirements } from "@/components/progressive-requirements";
import { DocumentUpload } from "@/components/document-upload";
import { AnalysisResults } from "@/components/analysis-results";
import { CorridorOverview } from "@/components/corridor-overview";
import { TravelDetails, UploadedDocument, DocumentExtraction, ComplianceItem } from "@/lib/types";
import { useDemoContext, fetchDemoDocument } from "@/lib/demo-context";
import { TranslationProvider, useTranslation, collectCorridorDynamicTexts } from "@/lib/i18n-context";
import { LanguageSelector } from "@/components/language-selector";
import { TranslationBanner } from "@/components/translation-banner";
import { ArrowLeft } from "lucide-react";
import { FadeText } from "@/components/fade-text";
import { countryFlag } from "@/lib/country-flags";

/** Format "2026-03-07" + "2026-03-17" → "Mar 7 – 17, 2026" or "Feb 25 – Mar 7, 2026" */
function formatDateRange(depart: string, returnDate: string): string {
  const d = new Date(depart + "T00:00:00");
  const r = new Date(returnDate + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const dStr = d.toLocaleDateString("en-US", opts);
  const rStr = r.toLocaleDateString("en-US", opts);
  const year = r.getFullYear();
  if (d.getMonth() === r.getMonth()) {
    // Same month: "Mar 7 – 17, 2026"
    return `${dStr} – ${r.getDate()}, ${year}`;
  }
  // Different months: "Feb 25 – Mar 7, 2026"
  return `${dStr} – ${rStr}, ${year}`;
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-12 text-center text-muted-foreground">Loading...</div>}>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { events, isStreaming, error, agentStatuses, agentStartTimes, result, start, reset } = useSSE({
    url: "/api/analyze",
  });

  const { pendingLoad, clearPending, demoDocuments, setDemoDocuments, suggestedLanguage, isDemoProfile, resetDemo } = useDemoContext();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [travelDetails, setTravelDetails] = useState<TravelDetails | null>(null);
  const [perDocExtractions, setPerDocExtractions] = useState<DocumentExtraction[]>([]);
  const [perDocCompliances, setPerDocCompliances] = useState<ComplianceItem[]>([]);

  const hasEvents = events.length > 0;
  const requirementsComplete = result?.requirements && !isStreaming;
  const plannedAgents = ["research", "document", "advisory"];

  // Callback when all per-requirement documents are analyzed
  const handleAllDocumentsAnalyzed = useCallback(
    (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => {
      setPerDocExtractions(extractions);
      setPerDocCompliances(compliances);
    },
    []
  );

  // Extract requirement items for translation
  const getRequirementItems = useCallback(() => {
    return events
      .filter((e) => e.type === "requirement")
      .map((e) => {
        if (e.type === "requirement") {
          return { name: e.item, description: e.detail || "" };
        }
        return { name: "", description: "" };
      })
      .filter((item) => item.name);
  }, [events]);

  // Extract dynamic texts from live feed for translation (Phase 3)
  // Includes thinking excerpts for full-page translation.
  const getFeedTexts = useCallback(() => {
    const texts: string[] = [];
    for (const event of events) {
      if (event.type === "recommendation" && event.action) {
        texts.push(event.action);
      }
      if (event.type === "thinking") {
        if (event.summary) texts.push(event.summary);
        if (event.excerpt) texts.push(event.excerpt);
      }
    }
    return texts;
  }, [events]);

  // Corridor info for translation
  const corridorInfo = useMemo(() => {
    if (result?.requirements) {
      return { corridor: result.requirements.corridor, visaType: result.requirements.visaType };
    }
    return null;
  }, [result?.requirements]);

  // Full requirements result for corridor dynamic text translation
  const getRequirementsResult = useCallback(() => {
    return result?.requirements || null;
  }, [result?.requirements]);

  // Initialize travel details from URL params
  useEffect(() => {
    const passportsJson = searchParams.get("passports");
    const destination = searchParams.get("destination");
    const purpose = searchParams.get("purpose");
    const depart = searchParams.get("depart");
    const returnDate = searchParams.get("return");
    const travelersStr = searchParams.get("travelers");
    const event = searchParams.get("event");

    if (passportsJson && destination && purpose && depart && returnDate && travelersStr) {
      const details: TravelDetails = {
        passports: JSON.parse(passportsJson),
        destination,
        purpose: purpose as TravelDetails["purpose"],
        dates: {
          depart,
          return: returnDate,
        },
        travelers: parseInt(travelersStr),
        event: event || undefined,
      };
      setTravelDetails(details);
      // If no demo persona is pending, this is a custom corridor — clear demo state
      if (!pendingLoad) {
        resetDemo();
      }
      // Auto-start analysis
      start({ travelDetails: details });
    } else {
      // If no params, redirect back to home
      router.push("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  // If a demo persona was loaded (via sidebar), fetch its document images
  useEffect(() => {
    if (pendingLoad && pendingLoad.documents.length > 0) {
      const docsWithImages = pendingLoad.documents.filter((d) => d.image);
      if (docsWithImages.length > 0) {
        Promise.all(docsWithImages.map((doc, i) => fetchDemoDocument(doc, i)))
          .then((fetched) => {
            setDocuments(fetched);
            setDemoDocuments(fetched);
          })
          .catch(() => {
            // Error handled silently - demo docs are optional
          });
      }
      clearPending();
    }
  }, [pendingLoad, clearPending, setDemoDocuments]);

  // Also pick up any previously fetched demo docs (e.g. loaded on home page before navigating)
  useEffect(() => {
    if (demoDocuments.length > 0 && documents.length === 0) {
      setDocuments(demoDocuments);
    }
  }, [demoDocuments, documents.length]);

  const handleDocumentAnalyze = () => {
    if (travelDetails) {
      start({ travelDetails, documents });
    }
  };

  const handleReset = () => {
    reset();
    setDocuments([]);
    router.push("/");
  };

  if (!travelDetails) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <TranslationProvider
      getRequirementItems={getRequirementItems}
      getFeedTexts={getFeedTexts}
      corridorInfo={corridorInfo}
      suggestedLanguage={suggestedLanguage || undefined}
      getRequirementsResult={getRequirementsResult}
    >
      <AnalyzePageInner
        travelDetails={travelDetails}
        events={events}
        isStreaming={isStreaming}
        error={error}
        agentStatuses={agentStatuses}
        agentStartTimes={agentStartTimes}
        result={result}
        documents={documents}
        setDocuments={setDocuments}
        hasEvents={hasEvents}
        requirementsComplete={requirementsComplete}
        plannedAgents={plannedAgents}
        perDocExtractions={perDocExtractions}
        handleAllDocumentsAnalyzed={handleAllDocumentsAnalyzed}
        handleDocumentAnalyze={handleDocumentAnalyze}
        handleReset={handleReset}
        suggestedLanguage={suggestedLanguage}
        isDemoProfile={isDemoProfile}
      />
    </TranslationProvider>
  );
}

/**
 * Inner component that lives inside TranslationProvider and can use useTranslation().
 */
function AnalyzePageInner({
  travelDetails,
  events,
  isStreaming,
  error,
  agentStatuses,
  agentStartTimes,
  result,
  documents,
  setDocuments,
  hasEvents,
  requirementsComplete,
  plannedAgents,
  perDocExtractions,
  handleAllDocumentsAnalyzed,
  handleDocumentAnalyze,
  handleReset,
  suggestedLanguage,
  isDemoProfile,
}: {
  travelDetails: TravelDetails;
  events: ReturnType<typeof useSSE>["events"];
  isStreaming: boolean;
  error: string | null;
  agentStatuses: Record<string, import("@/lib/types").AgentStatus>;
  agentStartTimes: Record<string, number>;
  result: ReturnType<typeof useSSE>["result"];
  documents: UploadedDocument[];
  setDocuments: (docs: UploadedDocument[]) => void;
  hasEvents: boolean;
  requirementsComplete: boolean | null | undefined;
  plannedAgents: string[];
  perDocExtractions: DocumentExtraction[];
  handleAllDocumentsAnalyzed: (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => void;
  handleDocumentAnalyze: () => void;
  handleReset: () => void;
  suggestedLanguage: string | null;
  isDemoProfile: boolean;
}) {
  const router = useRouter();
  const { t, language, isTranslating, translationPhase, setLanguage, translatedCorridorInfo, translateFeedContent } = useTranslation();

  // When research completes and language is non-English, translate feed content
  // AND corridor dynamic texts (fees, processing times, rejection reasons, etc.)
  const researchAgentComplete = agentStatuses.research === "complete";
  const feedTranslateTriggered = useRef(false);
  useEffect(() => {
    if (researchAgentComplete && language !== "English" && !feedTranslateTriggered.current) {
      feedTranslateTriggered.current = true;
      // Collect feed texts: recommendations, thinking summaries + excerpts
      const allTexts: string[] = [];
      for (const event of events) {
        if (event.type === "recommendation" && event.action) allTexts.push(event.action);
        if (event.type === "thinking") {
          if (event.summary) allTexts.push(event.summary);
          if (event.excerpt) allTexts.push(event.excerpt);
        }
      }
      // Also collect corridor dynamic texts from requirements result
      if (result?.requirements) {
        const corridorTexts = collectCorridorDynamicTexts(result.requirements);
        allTexts.push(...corridorTexts);
      }
      if (allTexts.length > 0) {
        translateFeedContent(allTexts);
      }
    }
    // Reset trigger when language changes back to English
    if (language === "English") {
      feedTranslateTriggered.current = false;
    }
  }, [researchAgentComplete, language, events, result?.requirements, translateFeedContent]);

  return (
    <>
      {/* Translation Progress Banner */}
      <TranslationBanner
        targetLanguage={language}
        phase={translationPhase}
        isVisible={isTranslating || translationPhase === "complete"}
      />

      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("Back to Home")}
        </button>

      {/* Header with travel details */}
      <section className="mb-10">
        {/* Top row: label + actions */}
        <div className="flex items-center justify-between mb-3">
          <FadeText
            text={t("Travel Requirements")}
            as="p"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          />
          <div className="flex items-center gap-2">
            <LanguageSelector
              currentLanguage={language}
              onLanguageChange={setLanguage}
              isTranslating={isTranslating}
              suggestedLanguage={suggestedLanguage || undefined}
              passports={travelDetails.passports}
              destination={travelDetails.destination}
            />
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 rounded-md transition-colors"
            >
              {t("New Check")}
            </button>
          </div>
        </div>

        {/* Corridor heading with flags */}
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl flex items-center gap-3 sm:gap-4 flex-wrap">
          <span className="inline-flex items-center gap-2 sm:gap-3">
            <span className="text-3xl sm:text-4xl" aria-hidden="true">{countryFlag(travelDetails.passports[0])}</span>
            <span>{travelDetails.passports.join(", ")}</span>
          </span>
          <span className="text-muted-foreground/40 font-light">→</span>
          <span className="inline-flex items-center gap-2 sm:gap-3">
            <span className="text-3xl sm:text-4xl" aria-hidden="true">{countryFlag(travelDetails.destination)}</span>
            <span>{travelDetails.destination}</span>
          </span>
        </h1>

        {/* Trip metadata: dates, purpose, travelers, visa type */}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{formatDateRange(travelDetails.dates.depart, travelDetails.dates.return)}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="capitalize">{t(travelDetails.purpose)}</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{travelDetails.travelers} {travelDetails.travelers === 1 ? t("traveler") : t("travelers")}</span>
          {result?.requirements && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {translatedCorridorInfo?.visaType || result.requirements.visaType}
              </span>
            </>
          )}
        </div>
      </section>

      {/* Agent Status + Live Feed */}
      {hasEvents && (
        <section className="space-y-4">
          <AgentStatusBar
            statuses={agentStatuses}
            plannedAgents={plannedAgents}
            agentStartTimes={agentStartTimes}
          />
          <LiveFeed events={events} />

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>
      )}

      {/* Progressive Requirements Display with Per-Requirement Upload */}
      {(events.some(e => e.type === "requirement") || result?.requirements) && (
        <section className="mt-8">
          <ProgressiveRequirements
            events={events}
            isStreaming={isStreaming}
            compliance={result?.analysis?.compliance?.items}
            corridorInfo={result?.requirements ? {
              corridor: result.requirements.corridor,
              visaType: result.requirements.visaType
            } : undefined}
            onAllDocumentsAnalyzed={handleAllDocumentsAnalyzed}
          />
        </section>
      )}

      {/* Corridor Intelligence Overview — appears when requirements are complete */}
      {result?.requirements && (
        <section className="mt-6">
          <CorridorOverview requirements={result.requirements} />
        </section>
      )}

      {/* Batch Document Upload — demo persona profiles only (pre-loaded fake documents) */}
      {isDemoProfile && requirementsComplete && !result?.analysis && perDocExtractions.length === 0 && documents.length > 0 && (
        <section className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{t("Upload Your Documents")}</h2>
            <p className="mt-2 text-muted-foreground">
              {t("Or upload all documents at once for batch analysis.")}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-6">
            <DocumentUpload
              documents={documents}
              onDocumentsChange={setDocuments}
              onAnalyze={handleDocumentAnalyze}
              isAnalyzing={isStreaming}
            />
          </div>
        </section>
      )}

      {/* Document Analysis Results */}
      {(events.some(e => e.type === "document_read") || result?.analysis) && (
        <section className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{t("Document Analysis")}</h2>
            <p className="mt-2 text-muted-foreground">
              {t("Verifying compliance and checking for potential issues.")}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-6">
            <AnalysisResults
              events={events}
              analysis={result?.analysis || {
                compliance: { met: 0, warnings: 0, critical: 0, items: [] },
                crossLingualFindings: [],
                narrativeAssessment: {
                  strength: "MODERATE",
                  issues: [],
                  summary: "",
                },
                forensicFlags: [],
              }}
              isStreaming={isStreaming}
            />
          </div>
        </section>
      )}
    </div>
    </>
  );
}
