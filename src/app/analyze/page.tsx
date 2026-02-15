"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSSE } from "@/hooks/use-sse";
import { LiveFeed } from "@/components/live-feed";
import { PhaseStepper } from "@/components/phase-stepper";
import { ProgressiveRequirements } from "@/components/progressive-requirements";
import { AnalysisResults } from "@/components/analysis-results";
import { AdvisoryCard } from "@/components/advisory-card";
import { AdvisoryModal } from "@/components/advisory-modal";
import { AdvisoryLoading } from "@/components/advisory-loading";
import { TravelDetails, UploadedDocument, DocumentExtraction, ComplianceItem, RequirementsChecklist, SSEEvent, AdvisoryReport, RemediationItem, ApplicationAssessment } from "@/lib/types";
import { buildPreliminaryAdvisory, updateAdvisoryWithCompliance } from "@/lib/advisory-builder";
import { useDemoContext, fetchDemoDocument } from "@/lib/demo-context";
import { TranslationProvider, useTranslation, collectCorridorDynamicTexts } from "@/lib/i18n-context";
import { LanguageSelector } from "@/components/language-selector";
import { TranslationBanner } from "@/components/translation-banner";
import { RemediationPanel } from "@/components/remediation-panel";
import { getRemediationByName, type PersonaRemediation } from "@/lib/remediation-data";
import { ArrowLeft, CheckCircle2, PartyPopper } from "lucide-react";
import { countryFlag } from "@/lib/country-flags";
import { isDevelopment } from "@/lib/env";

/**
 * Locale-aware greeting based on passport country.
 * Returns a warm, culturally-appropriate "welcome" in the traveler's likely native language.
 */
function getLocaleGreeting(passportCountry: string): string {
  const greetings: Record<string, string> = {
    "India": "Namaste",
    "Nigeria": "Welcome",
    "Brazil": "Bem-vindo",
    "Mexico": "Bienvenido",
    "Germany": "Willkommen",
    "France": "Bienvenue",
    "Spain": "Bienvenido",
    "Italy": "Benvenuto",
    "Japan": "ようこそ",
    "South Korea": "환영합니다",
    "China": "欢迎",
    "Russia": "Добро пожаловать",
    "Turkey": "Hoş geldiniz",
    "Saudi Arabia": "أهلاً وسهلاً",
    "UAE": "أهلاً وسهلاً",
    "Thailand": "ยินดีต้อนรับ",
    "Vietnam": "Chào mừng",
    "Indonesia": "Selamat datang",
    "Philippines": "Maligayang pagdating",
    "Pakistan": "خوش آمدید",
    "Bangladesh": "স্বাগতম",
    "Egypt": "أهلاً",
    "Poland": "Witamy",
    "Netherlands": "Welkom",
    "Portugal": "Bem-vindo",
    "Argentina": "Bienvenido",
    "Colombia": "Bienvenido",
    "Kenya": "Karibu",
    "Ethiopia": "እንኳን ደህና መጡ",
    "Ghana": "Akwaaba",
    "Morocco": "مرحبا",
    "Iran": "خوش آمدید",
    "Ukraine": "Ласкаво просимо",
    "Romania": "Bine ați venit",
    "Czech Republic": "Vítejte",
    "Sweden": "Välkommen",
    "Norway": "Velkommen",
    "Denmark": "Velkommen",
    "Finland": "Tervetuloa",
    "Greece": "Καλώς ήρθατε",
    "Israel": "ברוכים הבאים",
    "Malaysia": "Selamat datang",
    "Singapore": "Welcome",
    "Taiwan": "歡迎",
    "Peru": "Bienvenido",
    "Chile": "Bienvenido",
    "UK": "Welcome",
    "USA": "Welcome",
    "Canada": "Welcome",
    "Australia": "Welcome",
    "New Zealand": "Welcome",
    "Ireland": "Fáilte",
    "South Africa": "Welkom",
    "Nepal": "स्वागतम्",
    "Sri Lanka": "ආයුබෝවන්",
  };
  return greetings[passportCountry] || "Welcome";
}

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

/**
 * Type guard for orchestrator events with agent field
 */
function isOrchestratorEventWithAgent(event: SSEEvent): event is SSEEvent & {
  type: "orchestrator";
  agent?: string;
  action?: string;
} {
  return event.type === "orchestrator" && "agent" in event;
}

/**
 * Type guard for requirement events with uploadable property
 */
function isRequirementEventWithUploadable(event: SSEEvent): event is SSEEvent & {
  type: "requirement";
  uploadable?: boolean;
} {
  return event.type === "requirement";
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

  const { pendingLoad, clearPending, demoDocuments, setDemoDocuments, demoDocMetadata, suggestedLanguage, isDemoProfile, resetDemo, loadedPersonaName } = useDemoContext();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [travelDetails, setTravelDetails] = useState<TravelDetails | null>(null);
  const [perDocExtractions, setPerDocExtractions] = useState<DocumentExtraction[]>([]);
  const [perDocCompliances, setPerDocCompliances] = useState<ComplianceItem[]>([]);
  const [advisoryReport, setAdvisoryReport] = useState<AdvisoryReport | null>(null);
  const [showAdvisoryModal, setShowAdvisoryModal] = useState(false);
  const [isAdvisoryRunning, setIsAdvisoryRunning] = useState(false);
  const [documentImages, setDocumentImages] = useState<Map<string, { base64: string; mimeType: string }>>(new Map());
  const [isReauditing, setIsReauditing] = useState(false);
  const [reauditComplete, setReauditComplete] = useState(false);

  // Remediation data for the current demo persona
  const remediationData = useMemo(() => {
    if (!isDemoProfile || !loadedPersonaName) return null;
    return getRemediationByName(loadedPersonaName);
  }, [isDemoProfile, loadedPersonaName]);

  // Refs for two-phase advisory pipeline
  const preliminaryAdvisoryRef = useRef<AdvisoryReport | null>(null);
  const lastComplianceCountRef = useRef(0);

  // Debug: Log demo context state
  useEffect(() => {
    if (isDevelopment()) {
      console.log(`[AnalyzeContent] Demo context state:`, {
        isDemoProfile,
        hasPendingLoad: !!pendingLoad,
        pendingLoadDocs: pendingLoad?.documents.length || 0,
        demoDocumentsLength: demoDocuments.length,
        demoDocMetadataLength: demoDocMetadata.length,
      });
    }
  }, [isDemoProfile, pendingLoad, demoDocuments, demoDocMetadata]);

  const hasEvents = events.length > 0;
  const requirementsComplete = result?.requirements && !isStreaming;
  const plannedAgents = ["research", "document", "advisory"];

  // Phase 1: Build preliminary advisory immediately when requirements arrive
  useEffect(() => {
    if (result?.requirements && !preliminaryAdvisoryRef.current) {
      const preliminary = buildPreliminaryAdvisory(result.requirements);
      preliminaryAdvisoryRef.current = preliminary;
      setAdvisoryReport(preliminary);
      if (isDevelopment()) {
        console.log(`[Phase 1] Preliminary advisory built from ${result.requirements.items.length} requirements`);
      }
    }
  }, [result?.requirements]);

  // Phase 1b: Progressively update advisory as each doc_analysis_result event arrives
  useEffect(() => {
    if (!result?.requirements) return;

    const complianceResults = events
      .filter((e): e is Extract<SSEEvent, { type: "doc_analysis_result" }> => e.type === "doc_analysis_result")
      .map((e) => e.compliance);

    // Only update if we have new compliance results
    if (complianceResults.length === 0 || complianceResults.length === lastComplianceCountRef.current) return;
    lastComplianceCountRef.current = complianceResults.length;

    // Rebuild from scratch: preliminary + all compliances applied
    let updated = buildPreliminaryAdvisory(result.requirements);
    for (const compliance of complianceResults) {
      updated = updateAdvisoryWithCompliance(updated, compliance);
    }
    preliminaryAdvisoryRef.current = updated;
    setAdvisoryReport(updated);
    if (isDevelopment()) {
      console.log(`[Phase 1b] Advisory updated with ${complianceResults.length} compliance results`);
    }
  }, [events, result?.requirements]);

  // Phase 2: Track LLM advisory agent lifecycle (Opus 4.6 synthesis with extended thinking)
  // When it completes, replace preliminary advisory with refined version and show modal
  useEffect(() => {
    let assessment: ApplicationAssessment | null = null;
    const recommendations: RemediationItem[] = [];
    let interviewTips: string[] = [];
    let corridorWarnings: string[] = [];
    let advisoryComplete = false;
    let advisoryStarted = false;
    let priority = 1;

    for (const e of events) {
      if (e.type === "orchestrator" && e.agent?.toLowerCase().includes("advisory")) {
        if (e.action === "agent_start") {
          advisoryStarted = true;
        }
        if (e.action === "agent_complete") {
          advisoryComplete = true;
        }
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
      if (e.type === "advisory_tips") {
        interviewTips = e.interviewTips || [];
        corridorWarnings = e.corridorWarnings || [];
      }
    }

    // Update Phase 2 running indicator (subtle, non-blocking)
    if (advisoryStarted && !advisoryComplete) {
      setIsAdvisoryRunning(true);
    } else if (advisoryComplete) {
      setIsAdvisoryRunning(false);
    }

    // When Phase 2 LLM completes, replace advisory with refined version and show modal
    // Use LLM-refined tips/warnings if available, fall back to preliminary
    if (advisoryComplete && assessment && recommendations.length > 0) {
      const report: AdvisoryReport = {
        overall: assessment,
        fixes: recommendations,
        interviewTips: interviewTips.length > 0 ? interviewTips : (preliminaryAdvisoryRef.current?.interviewTips || []),
        corridorWarnings: corridorWarnings.length > 0 ? corridorWarnings : (preliminaryAdvisoryRef.current?.corridorWarnings || []),
      };
      setAdvisoryReport(report);
      // Don't auto-open — the CTA card invites the user to open when ready
    }
  }, [events]);

  // Callback when partial documents are analyzed — triggers Phase 2 advisory (lightweight LLM) EARLY
  const handlePartialDocumentsAnalyzed = useCallback(
    (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => {
      setPerDocExtractions(extractions);
      setPerDocCompliances(compliances);

      // Trigger Phase 2: lightweight LLM synthesis with preliminary fixes for refinement
      if (result?.requirements && !advisoryTriggeredRef.current) {
        if (isDevelopment()) {
          console.log(`[Phase 2] Starting Opus 4.6 synthesis with ${extractions.length} partial documents, ${preliminaryAdvisoryRef.current?.fixes.length || 0} preliminary fixes`);
        }
        advisoryTriggeredRef.current = true;
        runAdvisoryStream(result.requirements, extractions, compliances, preliminaryAdvisoryRef.current?.fixes);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result?.requirements]
  );

  // Callback when all per-requirement documents are analyzed — update state, possibly trigger Phase 2
  const handleAllDocumentsAnalyzed = useCallback(
    (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => {
      setPerDocExtractions(extractions);
      setPerDocCompliances(compliances);

      // Only trigger Phase 2 if not already started (fallback for non-demo or small doc sets)
      if (result?.requirements && !advisoryTriggeredRef.current) {
        if (isDevelopment()) {
          console.log(`[Phase 2] Starting Opus 4.6 synthesis with all ${extractions.length} documents, ${preliminaryAdvisoryRef.current?.fixes.length || 0} preliminary fixes`);
        }
        advisoryTriggeredRef.current = true;
        runAdvisoryStream(result.requirements, extractions, compliances, preliminaryAdvisoryRef.current?.fixes);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result?.requirements]
  );

  // Callback when document images are captured during upload (for advisory annotation)
  const handleDocumentImageCaptured = useCallback(
    (images: Map<string, { base64: string; mimeType: string }>) => {
      setDocumentImages(new Map(images));
    },
    []
  );

  // Handle "Apply Fixes & Re-check" from the remediation panel
  const handleApplyFixes = useCallback(async () => {
    if (!remediationData || !travelDetails || !demoDocMetadata.length) return;

    setIsReauditing(true);
    setReauditComplete(false);

    try {
      // Build corrected document set: start with originals, swap in corrected docs
      const correctedDocMeta = demoDocMetadata.map((doc) => {
        // Check if any fix replaces this document (match by original image path)
        const fix = remediationData.fixes.find((f) => f.originalDocImage === doc.image);
        if (fix) {
          return {
            name: fix.correctedDocName,
            language: fix.correctedDocLanguage,
            image: fix.correctedDocImage,
          };
        }
        return doc;
      });

      // Add any new documents (isNewDocument=true) that don't replace existing ones
      for (const fix of remediationData.fixes) {
        if (fix.isNewDocument) {
          const alreadyReplaced = correctedDocMeta.some((d) => d.image === fix.correctedDocImage);
          if (!alreadyReplaced) {
            correctedDocMeta.push({
              name: fix.correctedDocName,
              language: fix.correctedDocLanguage,
              image: fix.correctedDocImage,
            });
          }
        }
      }

      // Fetch all corrected documents as base64
      const correctedDocs = await Promise.all(
        correctedDocMeta.map((doc, i) => fetchDemoDocument(doc, i))
      );

      if (isDevelopment()) {
        console.log(`[Re-audit] Fetched ${correctedDocs.length} corrected documents`);
      }

      // Update document state
      setDocuments(correctedDocs);
      setDemoDocuments(correctedDocs);

      // Reset advisory pipeline
      advisoryTriggeredRef.current = false;
      preliminaryAdvisoryRef.current = null;
      lastComplianceCountRef.current = 0;
      setAdvisoryReport(null);
      setShowAdvisoryModal(false);
      setPerDocExtractions([]);
      setPerDocCompliances([]);

      // Re-start the full analysis pipeline with corrected documents
      start({ travelDetails, documents: correctedDocs });
    } catch (err) {
      if (isDevelopment()) {
        console.error("[Re-audit] Error:", err);
      }
      setIsReauditing(false);
    }
  }, [remediationData, travelDetails, demoDocMetadata, setDemoDocuments, start]);

  // Track re-audit completion
  useEffect(() => {
    if (!isReauditing) return;

    // Check if advisory agent has completed during re-audit
    const advisoryComplete = events.some(
      (e) => e.type === "orchestrator" && e.agent?.toLowerCase().includes("advisory") && e.action === "agent_complete"
    );

    if (advisoryComplete && advisoryReport) {
      setIsReauditing(false);
      setReauditComplete(true);
    }
  }, [isReauditing, events, advisoryReport]);

  // Stream Phase 2 advisory agent events into the main event feed
  const runAdvisoryStream = useCallback(
    async (
      requirements: RequirementsChecklist,
      extractions: DocumentExtraction[],
      compliances: ComplianceItem[],
      preliminaryFixes?: RemediationItem[]
    ) => {
      try {
        const response = await fetch("/api/advisory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirements, extractions, compliances, preliminaryFixes }),
        });

        if (!response.ok || !response.body) {
          if (isDevelopment()) {
            console.error("Advisory request failed:", response.status);
          }
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
                if (isDevelopment()) {
                  console.warn("Failed to parse advisory SSE event:", data);
                }
              }
            }
          }
        }
      } catch (err) {
        if (isDevelopment()) {
          console.error("Advisory stream error:", err);
        }
      }
    },
    [appendEvent]
  );

  // Track if we've already triggered advisory for this result
  const advisoryTriggeredRef = useRef(false);

  // Trigger Phase 2 immediately when main analysis completes (handles demo/bulk upload flow)
  useEffect(() => {
    // Skip if already triggered for this result
    if (advisoryTriggeredRef.current) return;

    // Need all three pieces of data from main orchestrator
    if (result?.requirements && result?.extractions && result?.analysis) {
      const compliances = result.analysis.compliance?.items || [];
      advisoryTriggeredRef.current = true;
      runAdvisoryStream(result.requirements, result.extractions, compliances, preliminaryAdvisoryRef.current?.fixes);
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
        if (isDevelopment()) {
          console.log(`[AnalyzeContent] Resetting demo state (no pending load, no demo docs)`);
        }
        resetDemo();
      }
      // Auto-start analysis
      advisoryTriggeredRef.current = false; // Reset for new analysis
      preliminaryAdvisoryRef.current = null;
      lastComplianceCountRef.current = 0;
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
      if (isDevelopment()) {
        console.log(`[Demo Load] Found ${docsWithImages.length} demo documents:`, docsWithImages.map(d => d.name));
      }

      if (docsWithImages.length > 0) {
        // Metadata is already stored in context by loadDemo()
        if (isDevelopment()) {
          console.log(`[Demo Load] demoDocMetadata already set by context, fetching document blobs`);
        }

        Promise.all(docsWithImages.map((doc, i) => fetchDemoDocument(doc, i)))
          .then((fetched) => {
            setDocuments(fetched);
            setDemoDocuments(fetched);
            if (isDevelopment()) {
              console.log(`[Demo Load] Fetched and set ${fetched.length} documents`);
            }
          })
          .catch((err) => {
            if (isDevelopment()) {
              console.error(`[Demo Load] Error fetching documents:`, err);
            }
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
      preliminaryAdvisoryRef.current = null;
      lastComplianceCountRef.current = 0;
      start({ travelDetails, documents });
    }
  };

  const handleReset = () => {
    advisoryTriggeredRef.current = false; // Reset flag
    preliminaryAdvisoryRef.current = null;
    lastComplianceCountRef.current = 0;
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
        documentImages={documentImages}
        handleDocumentImageCaptured={handleDocumentImageCaptured}
        remediationData={remediationData}
        isReauditing={isReauditing}
        reauditComplete={reauditComplete}
        onApplyFixes={handleApplyFixes}
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
  documentImages,
  handleDocumentImageCaptured,
  remediationData,
  isReauditing,
  reauditComplete,
  onApplyFixes,
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
  documentImages: Map<string, { base64: string; mimeType: string }>;
  handleDocumentImageCaptured: (images: Map<string, { base64: string; mimeType: string }>) => void;
  remediationData: PersonaRemediation | null;
  isReauditing: boolean;
  reauditComplete: boolean;
  onApplyFixes: () => void;
}) {
  const router = useRouter();
  const { t, language, isTranslating, translationPhase, setLanguage, translatedCorridorInfo, translateFeedContent } = useTranslation();
  const { sidebarOpen, loadedPersonaName } = useDemoContext();

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

  // --- Derived state for the phase stepper and progress narration ---
  const researchDone = agentStatuses.research === "complete" || agentStatuses.research === "cached";
  const requirementEvents = events.filter(e => e.type === "requirement");
  const totalUploadableReqs = requirementEvents.filter(e => isRequirementEventWithUploadable(e) && e.uploadable !== false).length;

  // Count verified documents from doc_analysis_result events
  const docsVerified = events.filter(e => e.type === "doc_analysis_result").length;

  // --- Contextual greeting + intro paragraph ---
  const firstName = loadedPersonaName?.split(" ")[0] || null;
  const showPersonaName = isDemoProfile && firstName && docsVerified > 0;

  // Locale-aware greeting based on passport origin
  const localeGreeting = getLocaleGreeting(travelDetails.passports[0]);

  // Build the intro sentence that explains what the system does
  const dest = travelDetails.destination;
  const purpose = travelDetails.purpose;
  const introText = (() => {
    const name = showPersonaName ? firstName : null;
    const greeting = name ? `${name}, ${localeGreeting.toLowerCase()}` : localeGreeting;

    // Short, purposeful explanation — 1 sentence max
    switch (purpose) {
      case "tourism":
        return `${greeting} \u2014 we\u2019re checking your documents against ${dest}\u2019s requirements so nothing holds up your trip.`;
      case "business":
        return `${greeting} \u2014 we\u2019re verifying your documents meet ${dest}\u2019s business visa requirements before you apply.`;
      case "work":
        return `${greeting} \u2014 we\u2019re reviewing your documents for ${dest} work authorization compliance.`;
      case "study":
        return `${greeting} \u2014 we\u2019re checking your documents against ${dest}\u2019s student visa requirements.`;
      case "medical":
        return `${greeting} \u2014 we\u2019re verifying your documents for ${dest}\u2019s medical visa requirements.`;
      case "family":
        return `${greeting} \u2014 we\u2019re checking your documents for ${dest}\u2019s family visa requirements.`;
      case "transit":
        return `${greeting} \u2014 we\u2019re confirming your documents meet ${dest}\u2019s transit requirements.`;
      default:
        return `${greeting} \u2014 we\u2019re reviewing your documents against ${dest}\u2019s visa requirements.`;
    }
  })();

  // Trip duration in days
  const tripDays = Math.ceil(
    (new Date(travelDetails.dates.return).getTime() - new Date(travelDetails.dates.depart).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  // Advisory ready = we have a report AND the advisory agent is complete
  const advisoryAgentComplete = events.some(
    e => isOrchestratorEventWithAgent(e) &&
         e.agent?.toLowerCase().includes("advisory") &&
         e.action === "agent_complete"
  );

  // Progress narration text — contextual for demo personas
  const progressNarration = (() => {
    if (!researchDone) return null;
    if (totalUploadableReqs === 0) return null;
    const name = firstName || null;
    if (advisoryAgentComplete && advisoryReport) {
      return name ? `${name}'s assessment is ready` : t("Your assessment is ready");
    }
    if (docsVerified >= totalUploadableReqs) {
      return name
        ? `All of ${name}'s documents verified. Preparing assessment\u2026`
        : t("All documents verified") + ". " + t("Preparing your assessment\u2026");
    }
    if (docsVerified === 0) return t("Upload your first document");
    if (docsVerified === 1) return `Great start! 1 of ${totalUploadableReqs} verified`;
    if (docsVerified >= totalUploadableReqs * 0.5) return `Almost there \u2014 ${docsVerified} of ${totalUploadableReqs} verified`;
    return `${docsVerified} of ${totalUploadableReqs} verified. Keep going\u2026`;
  })();

  return (
    <>
      {/* Translation Progress Banner */}
      <TranslationBanner
        targetLanguage={language}
        phase={translationPhase}
        isVisible={isTranslating || translationPhase === "complete"}
      />

      <div
        className="transition-[padding-left] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[padding-left]"
        style={{ paddingLeft: sidebarOpen ? '23rem' : '0px' }}
      >
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

      {/* Header — corridor card */}
      <section className="mb-6 rounded-xl border border-border/60 bg-card/50 overflow-hidden">
        {/* Top bar: language selector */}
        <div className="flex justify-end px-5 pt-4 pb-0">
          <LanguageSelector
            currentLanguage={language}
            onLanguageChange={setLanguage}
            isTranslating={isTranslating}
            suggestedLanguage={suggestedLanguage || undefined}
            passports={travelDetails.passports}
            destination={travelDetails.destination}
          />
        </div>

        {/* Main content */}
        <div className="px-5 pb-5 pt-2">
          {/* Corridor visual: FROM → TO */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Origin */}
            <div className="flex items-center gap-2.5">
              <span className="text-4xl sm:text-5xl" aria-hidden="true">{countryFlag(travelDetails.passports[0])}</span>
              <div>
                <p className="text-lg sm:text-xl font-semibold leading-tight">{travelDetails.passports[0]}</p>
                <p className="text-xs text-muted-foreground">{t("Passport")}</p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <svg className="w-6 h-6 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <span className="text-[10px] text-muted-foreground/50 font-medium">{tripDays}d</span>
            </div>

            {/* Destination */}
            <div className="flex items-center gap-2.5">
              <span className="text-4xl sm:text-5xl" aria-hidden="true">{countryFlag(travelDetails.destination)}</span>
              <div>
                <p className="text-lg sm:text-xl font-semibold leading-tight">{travelDetails.destination}</p>
                <p className="text-xs text-muted-foreground capitalize">{t(travelDetails.purpose)}</p>
              </div>
            </div>
          </div>

          {/* Trip details row */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="11" rx="1.5" />
                <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
              </svg>
              {formatDateRange(travelDetails.dates.depart, travelDetails.dates.return)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="5" r="3" />
                <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
              </svg>
              {travelDetails.travelers} {travelDetails.travelers === 1 ? t("traveler") : t("travelers")}
            </span>
            {result?.requirements && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                {translatedCorridorInfo?.visaType || result.requirements.visaType}
              </span>
            )}
          </div>

          {/* Contextual intro */}
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {introText}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PHASE STEPPER — Sticky workflow indicator (replaces AgentStatusBar)
          ══════════════════════════════════════════════════════════════ */}
      {hasEvents && (
        <PhaseStepper
          agentStatuses={agentStatuses}
          agentStartTimes={agentStartTimes}
          docsVerified={docsVerified}
          docsTotal={totalUploadableReqs}
          advisoryReady={advisoryAgentComplete && !!advisoryReport}
          advisoryRunning={isAdvisoryRunning}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          RESEARCH FEED — Always-visible narrative of the search process
          ══════════════════════════════════════════════════════════════ */}
      {hasEvents && (
        <section className="mb-6">
          <LiveFeed events={events} />
          {error && (
            <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>
      )}

      {/* Progress narration — gentle guide text */}
      {progressNarration && docsVerified > 0 && !advisoryAgentComplete && (
        <p className="mb-3 text-xs text-muted-foreground animate-in fade-in duration-300">
          {progressNarration}
        </p>
      )}

      {/* ══════════════════════════════════════════════════════════════
          REQUIREMENTS LIST — The core interactive checklist
          ══════════════════════════════════════════════════════════════ */}
      {(events.some(e => e.type === "requirement") || result?.requirements) && (
        <section>
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
            onDocumentImageCaptured={handleDocumentImageCaptured}
            isDemoProfile={isDemoProfile}
            demoDocuments={demoDocMetadata}
          />
        </section>
      )}

      {/* Advisory refinement indicator — subtle inline indicator during Phase 2 LLM synthesis */}
      <AdvisoryLoading isVisible={isAdvisoryRunning} />

      {/* ══════════════════════════════════════════════════════════════
          ADVISORY CTA — Natural conclusion card (replaces surprise modal)
          ══════════════════════════════════════════════════════════════ */}
      {advisoryAgentComplete && advisoryReport && !showAdvisoryModal && (
        <div className="mt-8 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 px-6 py-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("Your assessment is ready")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Personalized recommendations based on your documents and corridor requirements.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvisoryModal(true)}
              className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              {t("View Assessment")}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          RE-AUDIT SUCCESS BANNER — shown after corrected docs pass
          ══════════════════════════════════════════════════════════════ */}
      {reauditComplete && advisoryReport?.overall === "APPLICATION_PROCEEDS" && (
        <div className="mt-8 rounded-xl border-2 border-emerald-300 dark:border-emerald-500/30 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 px-6 py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <PartyPopper className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                All Issues Resolved — Application Proceeds
              </h3>
              <p className="mt-1 text-sm text-emerald-600/80 dark:text-emerald-400/70 leading-relaxed">
                The corrected documents have passed all checks. {remediationData?.personaName.split(" ")[0]}&apos;s application
                now meets all visa requirements for this corridor. The fixes addressed {remediationData?.fixes.length} issues:
                cross-document consistency, official documentation standards, and completeness requirements.
              </p>
              <div className="flex items-center gap-4 mt-3">
                {remediationData?.fixes.map((fix) => (
                  <span
                    key={fix.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {fix.issueTitle.split(" — ")[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          REMEDIATION PANEL — Fix Wizard for demo personas
          Shows after advisory completes, before re-audit
          ══════════════════════════════════════════════════════════════ */}
      {remediationData && advisoryAgentComplete && advisoryReport && !reauditComplete && (
        <RemediationPanel
          remediation={remediationData}
          onApplyFixes={onApplyFixes}
          isReauditing={isReauditing}
        />
      )}

      {/* Advisory Modal — opened via CTA button, not auto-popup */}
      {advisoryReport && (
        <AdvisoryModal
          advisory={advisoryReport}
          isOpen={showAdvisoryModal}
          onClose={() => setShowAdvisoryModal(false)}
          documentImages={documentImages}
          extractions={perDocExtractions}
        />
      )}
    </div>
    </div>
    </>
  );
}
