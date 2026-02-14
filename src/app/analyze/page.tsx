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
import { AdvisoryCard } from "@/components/advisory-card";
import { AdvisoryModal } from "@/components/advisory-modal";
import { AdvisoryLoading } from "@/components/advisory-loading";
import { TravelDetails, UploadedDocument, DocumentExtraction, ComplianceItem, RequirementsChecklist, SSEEvent, AdvisoryReport, RemediationItem, ApplicationAssessment } from "@/lib/types";
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
  const { events, isStreaming, error, agentStatuses, agentStartTimes, result, start, reset, appendEvent } = useSSE({
    url: "/api/analyze",
  });

  const { pendingLoad, clearPending, demoDocuments, setDemoDocuments, demoDocMetadata, suggestedLanguage, isDemoProfile, resetDemo } = useDemoContext();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [travelDetails, setTravelDetails] = useState<TravelDetails | null>(null);
  const [perDocExtractions, setPerDocExtractions] = useState<DocumentExtraction[]>([]);
  const [perDocCompliances, setPerDocCompliances] = useState<ComplianceItem[]>([]);
  const [advisoryReport, setAdvisoryReport] = useState<AdvisoryReport | null>(null);
  const [showAdvisoryModal, setShowAdvisoryModal] = useState(false);
  const [isAdvisoryRunning, setIsAdvisoryRunning] = useState(false);

  // Debug: Log demo context state
  useEffect(() => {
    console.log(`[AnalyzeContent] Demo context state:`, {
      isDemoProfile,
      hasPendingLoad: !!pendingLoad,
      pendingLoadDocs: pendingLoad?.documents.length || 0,
      demoDocumentsLength: demoDocuments.length,
      demoDocMetadataLength: demoDocMetadata.length,
    });
  }, [isDemoProfile, pendingLoad, demoDocuments, demoDocMetadata]);

  const hasEvents = events.length > 0;
  const requirementsComplete = result?.requirements && !isStreaming;
  const plannedAgents = ["research", "document", "advisory"];

  // Collect advisory report from events and show modal when complete
  useEffect(() => {
    let assessment: ApplicationAssessment | null = null;
    const recommendations: RemediationItem[] = [];
    const interviewTips: string[] = [];
    const corridorWarnings: string[] = [];
    let advisoryComplete = false;
    let advisoryStarted = false;
    let priority = 1;

    for (const e of events) {
      if (e.type === "orchestrator" && e.agent?.toLowerCase().includes("advisory")) {
        if (e.action === "agent_start") advisoryStarted = true;
        if (e.action === "agent_complete") advisoryComplete = true;
      }
      if (e.type === "assessment") {
        assessment = e.overall as ApplicationAssessment;
      }
      if (e.type === "recommendation") {
        recommendations.push({
          priority: priority++,
          severity: e.priority as "critical" | "warning" | "info",
          issue: e.details || "",
          fix: e.action,
        });
      }
    }

    // Update advisory running state
    if (advisoryStarted && !advisoryComplete) {
      setIsAdvisoryRunning(true);
    } else if (advisoryComplete) {
      setIsAdvisoryRunning(false);
    }

    // If advisory is complete and we have data, build the report and show modal
    if (advisoryComplete && assessment && recommendations.length > 0) {
      const report: AdvisoryReport = {
        overall: assessment,
        fixes: recommendations,
        interviewTips,
        corridorWarnings,
      };
      setAdvisoryReport(report);
      setShowAdvisoryModal(true);
    }
  }, [events]);

  // Callback when partial documents are analyzed — triggers advisory agent EARLY
  const handlePartialDocumentsAnalyzed = useCallback(
    (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => {
      setPerDocExtractions(extractions);
      setPerDocCompliances(compliances);

      // Trigger advisory agent early with partial results
      if (result?.requirements && !advisoryTriggeredRef.current) {
        console.log(`[Early Advisory] Starting with ${extractions.length} partial documents`);
        advisoryTriggeredRef.current = true;
        runAdvisoryStream(result.requirements, extractions, compliances);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result?.requirements]
  );

  // Callback when all per-requirement documents are analyzed — update state, possibly trigger advisory
  const handleAllDocumentsAnalyzed = useCallback(
    (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => {
      setPerDocExtractions(extractions);
      setPerDocCompliances(compliances);

      // Only trigger advisory if not already started (fallback for non-demo or small doc sets)
      if (result?.requirements && !advisoryTriggeredRef.current) {
        console.log(`[Advisory] Starting with all ${extractions.length} documents`);
        advisoryTriggeredRef.current = true;
        runAdvisoryStream(result.requirements, extractions, compliances);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result?.requirements]
  );

  // Stream advisory agent events into the main event feed
  const runAdvisoryStream = useCallback(
    async (
      requirements: RequirementsChecklist,
      extractions: DocumentExtraction[],
      compliances: ComplianceItem[]
    ) => {
      try {
        const response = await fetch("/api/advisory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirements, extractions, compliances }),
        });

        if (!response.ok || !response.body) {
          console.error("Advisory request failed:", response.status);
          return;
        }

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
              if (data === "[DONE]") return;

              try {
                const event = JSON.parse(data) as SSEEvent;
                appendEvent(event);
              } catch {
                console.warn("Failed to parse advisory SSE event:", data);
              }
            }
          }
        }
      } catch (err) {
        console.error("Advisory stream error:", err);
      }
    },
    [appendEvent]
  );

  // Track if we've already triggered advisory for this result
  const advisoryTriggeredRef = useRef(false);

  // Trigger advisory immediately when main analysis completes (handles demo/bulk upload flow)
  useEffect(() => {
    // Skip if already triggered for this result
    if (advisoryTriggeredRef.current) return;

    // Need all three pieces of data from main orchestrator
    if (result?.requirements && result?.extractions && result?.analysis) {
      const compliances = result.analysis.compliance?.items || [];
      advisoryTriggeredRef.current = true;
      runAdvisoryStream(result.requirements, result.extractions, compliances);
    }
  }, [result, runAdvisoryStream]);

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
      // If no demo persona is pending AND no demo docs loaded, this is a custom corridor — clear demo state
      // Don't reset if we already have demo documents (they were loaded on home page)
      if (!pendingLoad && demoDocuments.length === 0 && !isDemoProfile) {
        console.log(`[AnalyzeContent] Resetting demo state (no pending load, no demo docs)`);
        resetDemo();
      }
      // Auto-start analysis
      advisoryTriggeredRef.current = false; // Reset for new analysis
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
      console.log(`[Demo Load] Found ${docsWithImages.length} demo documents:`, docsWithImages.map(d => d.name));

      if (docsWithImages.length > 0) {
        // Metadata is already stored in context by loadDemo()
        console.log(`[Demo Load] demoDocMetadata already set by context, fetching document blobs`);

        Promise.all(docsWithImages.map((doc, i) => fetchDemoDocument(doc, i)))
          .then((fetched) => {
            setDocuments(fetched);
            setDemoDocuments(fetched);
            console.log(`[Demo Load] Fetched and set ${fetched.length} documents`);
          })
          .catch((err) => {
            console.error(`[Demo Load] Error fetching documents:`, err);
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
      advisoryTriggeredRef.current = false; // Reset for new analysis
      start({ travelDetails, documents });
    }
  };

  const handleReset = () => {
    advisoryTriggeredRef.current = false; // Reset flag
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
        handlePartialDocumentsAnalyzed={handlePartialDocumentsAnalyzed}
        handleAllDocumentsAnalyzed={handleAllDocumentsAnalyzed}
        handleDocumentAnalyze={handleDocumentAnalyze}
        handleReset={handleReset}
        suggestedLanguage={suggestedLanguage}
        isDemoProfile={isDemoProfile}
        advisoryReport={advisoryReport}
        showAdvisoryModal={showAdvisoryModal}
        setShowAdvisoryModal={setShowAdvisoryModal}
        isAdvisoryRunning={isAdvisoryRunning}
        demoDocMetadata={demoDocMetadata}
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
  handlePartialDocumentsAnalyzed,
  handleAllDocumentsAnalyzed,
  handleDocumentAnalyze,
  handleReset,
  suggestedLanguage,
  isDemoProfile,
  advisoryReport,
  showAdvisoryModal,
  setShowAdvisoryModal,
  isAdvisoryRunning,
  demoDocMetadata,
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
  handlePartialDocumentsAnalyzed: (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => void;
  handleAllDocumentsAnalyzed: (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => void;
  handleDocumentAnalyze: () => void;
  handleReset: () => void;
  suggestedLanguage: string | null;
  isDemoProfile: boolean;
  advisoryReport: AdvisoryReport | null;
  showAdvisoryModal: boolean;
  setShowAdvisoryModal: (show: boolean) => void;
  isAdvisoryRunning: boolean;
  demoDocMetadata: Array<{ name: string; language: string; image: string }>;
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
            onPartialDocumentsAnalyzed={handlePartialDocumentsAnalyzed}
            onAllDocumentsAnalyzed={handleAllDocumentsAnalyzed}
            isDemoProfile={isDemoProfile}
            demoDocuments={demoDocMetadata}
          />
        </section>
      )}

      {/* Corridor Intelligence Overview — appears when requirements are complete */}
      {result?.requirements && (
        <section className="mt-6">
          <CorridorOverview requirements={result.requirements} />
        </section>
      )}

      {/* Advisory Loading — appears while advisory agent is thinking */}
      <AdvisoryLoading isVisible={isAdvisoryRunning} />

      {/* Advisory Modal — appears when advisory agent completes */}
      {advisoryReport && (
        <AdvisoryModal
          advisory={advisoryReport}
          isOpen={showAdvisoryModal}
          onClose={() => setShowAdvisoryModal(false)}
        />
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
