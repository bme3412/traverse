"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSSE } from "@/hooks/use-sse";
import { LiveFeed } from "@/components/live-feed";
import { FloatingAgentStatus } from "@/components/floating-agent-status";
import { PhaseStepper } from "@/components/phase-stepper";
import { ProgressiveRequirements } from "@/components/progressive-requirements";
import { AnalysisResults } from "@/components/analysis-results";
import { AdvisoryCard } from "@/components/advisory-card";
import { AdvisoryModal } from "@/components/advisory-modal";
import { AdvisoryLoading } from "@/components/advisory-loading";
import { TravelDetails, UploadedDocument, DocumentExtraction, ComplianceItem, RequirementsChecklist, SSEEvent, AdvisoryReport, RemediationItem, ApplicationAssessment, ReauditProgress, ReauditFixStatus } from "@/lib/types";
import { buildPreliminaryAdvisory, updateAdvisoryWithCompliance } from "@/lib/advisory-builder";
import { useDemoContext, fetchDemoDocument } from "@/lib/demo-context";
import { TranslationProvider, useTranslation, collectCorridorDynamicTexts } from "@/lib/i18n-context";
import { LanguageSelector } from "@/components/language-selector";
import { TranslationBanner } from "@/components/translation-banner";
import { getRemediationByName, type PersonaRemediation } from "@/lib/remediation-data";
import { ArrowLeft } from "lucide-react";
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

/**
 * Generate multi-language intro texts for demo personas.
 * Returns intro in native language, English, and destination language.
 * Colors match the header pattern: blue → purple → emerald
 */
function getMultiLanguageIntroTexts(
  origin: string,
  destination: string,
  purpose: string,
  personaName: string
): Array<{ language: string; color: "blue" | "purple" | "emerald"; text: string }> | null {
  // Helper to generate the explanation text based on purpose
  const getExplanation = (dest: string, greet: string) => {
    switch (purpose) {
      case "tourism":
        return `${greet} — we're checking your documents against ${dest}'s requirements so nothing holds up your trip.`;
      case "business":
        return `${greet} — we're verifying your documents meet ${dest}'s business visa requirements before you apply.`;
      case "work":
        return `${greet} — we're reviewing your documents for ${dest} work authorization compliance.`;
      case "study":
        return `${greet} — we're checking your documents against ${dest}'s student visa requirements.`;
      case "medical":
        return `${greet} — we're verifying your documents for ${dest}'s medical visa requirements.`;
      case "family":
        return `${greet} — we're checking your documents for ${dest}'s family visa requirements.`;
      case "transit":
        return `${greet} — we're confirming your documents meet ${dest}'s transit requirements.`;
      default:
        return `${greet} — we're reviewing your documents against ${dest}'s visa requirements.`;
    }
  };

  // Priya Sharma: India → Germany (Business)
  // Order: English (blue) → Hindi (purple) → German (emerald)
  if (personaName === "Priya Sharma") {
    return [
      {
        language: "English",
        color: "blue",
        text: getExplanation(destination, "Welcome")
      },
      {
        language: "Hindi (हिंदी)",
        color: "purple",
        text: purpose === "business"
          ? `नमस्ते — हम आपके दस्तावेज़ों को ${destination} की व्यावसायिक वीज़ा आवश्यकताओं के विरुद्ध सत्यापित कर रहे हैं।`
          : `नमस्ते — हम आपके दस्तावेज़ों की जाँच कर रहे हैं ताकि आपकी यात्रा में कोई बाधा न आए।`
      },
      {
        language: "German (Deutsch)",
        color: "emerald",
        text: purpose === "business"
          ? `Willkommen — wir überprüfen Ihre Dokumente auf die Geschäftsvisumanforderungen von ${destination}.`
          : `Willkommen — wir prüfen Ihre Dokumente gegen die Anforderungen von ${destination}.`
      }
    ];
  }

  // Amara Okafor: Nigeria → United Kingdom (Student)
  // Order: English (blue) → Yoruba (purple) → British English (emerald)
  if (personaName === "Amara Okafor") {
    return [
      {
        language: "English",
        color: "blue",
        text: getExplanation(destination, "Welcome")
      },
      {
        language: "Yoruba",
        color: "purple",
        text: purpose === "study"
          ? `Káàbọ̀ — a ń ṣàyẹ̀wò àwọn ìwé rẹ lọ́wọ́ àwọn ìbéèrè fáàsì ọmọ ilé-ìwé ${destination}.`
          : `Káàbọ̀ — a ń wo àwọn ìwé rẹ lati rii pe ko si ohun ti yoo da irin-ajo re duro.`
      },
      {
        language: "British English",
        color: "emerald",
        text: purpose === "study"
          ? `Welcome — we're checking your documents against ${destination}'s student visa requirements.`
          : getExplanation(destination, "Welcome")
      }
    ];
  }

  // Carlos Mendes: Brazil → Japan (Tourism)
  // Order: Portuguese (blue) → English (purple) → Japanese (emerald)
  if (personaName === "Carlos Mendes") {
    return [
      {
        language: "Portuguese (Português)",
        color: "blue",
        text: purpose === "tourism"
          ? `Bem-vindo — estamos verificando seus documentos contra os requisitos do ${destination} para que nada atrapalhe sua viagem.`
          : `Bem-vindo — estamos revisando seus documentos contra os requisitos de visto do ${destination}.`
      },
      {
        language: "English",
        color: "purple",
        text: getExplanation(destination, "Welcome")
      },
      {
        language: "Japanese (日本語)",
        color: "emerald",
        text: purpose === "tourism"
          ? `ようこそ — 旅行に支障がないよう、${destination}の要件に照らして書類を確認しています。`
          : `ようこそ — ${destination}のビザ要件に対して書類を確認しています。`
      }
    ];
  }

  return null;
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
 * Returns a plain-language description of what a visa type is and who it's for.
 * When trip context is provided, the description is personalized to the traveler's
 * specific origin, destination, purpose, and duration.
 */
function getVisaDescription(
  visaType: string,
  tripContext?: { origin: string; destination: string; purpose: string; days: number },
): string {
  const v = visaType.toLowerCase();

  // Helper: build a contextual prefix like "For your 15-day business travel from India to Germany, you will need"
  const ctx = tripContext
    ? `For your ${tripContext.days}-day ${tripContext.purpose} travel from ${tripContext.origin} to ${tripContext.destination}, you will need `
    : "";

  // Schengen visas
  if (v.includes("schengen") && v.includes("type c")) {
    if (v.includes("business")) return `${ctx}a short-stay Schengen visa allowing business activities — meetings, conferences, trade fairs, and contract negotiations — in any of the 27 Schengen Area countries for up to 90 days within a 180-day period.`;
    if (v.includes("tourist") || v.includes("tourism")) return `${ctx}a short-stay Schengen visa for tourism and leisure travel across any of the 27 Schengen Area countries, valid for up to 90 days within a 180-day period.`;
    if (v.includes("medical")) return `${ctx}a short-stay Schengen visa for medical treatment in any Schengen Area country, valid for up to 90 days within a 180-day period.`;
    if (v.includes("visit") || v.includes("family")) return `${ctx}a short-stay Schengen visa for visiting family or friends in any Schengen Area country, valid for up to 90 days within a 180-day period.`;
    return `${ctx}a short-stay Schengen Area visa (Type C) valid for up to 90 days within a 180-day period. Allows travel across all 27 Schengen member states with a single visa.`;
  }
  if (v.includes("schengen") && v.includes("type d")) return `${ctx}a long-stay national visa for the specific Schengen country, typically for work, study, or family reunification. Valid beyond 90 days, issued under national — not Schengen-wide — rules.`;
  if (v.includes("schengen")) return `${ctx}a Schengen Area visa allowing travel across 27 European countries. Short-stay (Type C) permits up to 90 days; long-stay (Type D) is issued by individual member states for extended purposes.`;

  // UK visas
  if (v.includes("uk") || v.includes("united kingdom") || v.includes("british")) {
    if (v.includes("standard visitor") || v.includes("visitor visa")) return `${ctx}a UK Standard Visitor Visa for tourism, business meetings, conferences, or short courses. Usually valid for up to 6 months. Does not permit employment.`;
    if (v.includes("student") || v.includes("tier 4") || v.includes("cas")) return `${ctx}a UK Student Visa (formerly Tier 4) for studying at a licensed UK institution. Requires a Confirmation of Acceptance for Studies (CAS). Duration tied to course length.`;
    if (v.includes("work") || v.includes("skilled worker") || v.includes("tier 2")) return `${ctx}a UK Skilled Worker Visa (formerly Tier 2) for employment with a licensed UK sponsor. Requires a job offer meeting the salary and skill threshold.`;
    if (v.includes("family")) return `${ctx}a UK Family Visa for joining or accompanying a family member who is a British citizen or settled person. Requires proof of relationship and financial support.`;
    return `${ctx}a United Kingdom visa issued under the UK's points-based immigration system. Requirements vary by purpose of travel — tourism, work, study, or family.`;
  }

  // US visas
  if (v.includes("b-1") && v.includes("b-2")) return `${ctx}a US B-1/B-2 combined visitor visa for business (B-1) and tourism/pleasure (B-2). The most common US nonimmigrant visa, typically valid for up to 10 years with stays of up to 6 months per entry.`;
  if (v.includes("b-1")) return `${ctx}a US B-1 Business Visitor Visa for attending meetings, conferences, negotiations, or consultations. Does not permit employment. Typically valid for up to 10 years with 6-month stays.`;
  if (v.includes("b-2")) return `${ctx}a US B-2 Tourist Visa for tourism, vacation, visiting friends or family, or medical treatment. Typically valid for up to 10 years with stays of up to 6 months per entry.`;
  if (v.includes("f-1")) return `${ctx}a US F-1 Student Visa for full-time academic study at an accredited US institution. Requires a Form I-20 from the school. Valid for the duration of the academic program.`;
  if (v.includes("h-1b")) return `${ctx}a US H-1B Work Visa for specialty occupation employment requiring a bachelor's degree or equivalent. Employer-sponsored, subject to annual cap. Initially valid for 3 years, extendable to 6.`;
  if (v.includes("j-1")) return `${ctx}a US J-1 Exchange Visitor Visa for approved exchange programs including research, teaching, internships, and cultural exchange. Requires a DS-2019 form from the program sponsor.`;
  if (v.includes("esta") || v.includes("visa waiver")) return `${ctx ? ctx.replace("you will need ", "") + "you can use " : ""}the US Visa Waiver Program (ESTA), which allows citizens of 41 participating countries to visit the US for up to 90 days without a visa. Requires pre-travel electronic authorization.`;

  // Japan
  if (v.includes("japan")) {
    if (v.includes("tourist") || v.includes("tourism") || v.includes("temporary visitor")) return `${ctx}a Japan Temporary Visitor Visa for tourism, business meetings, visiting friends, or attending events. Stays of up to 15, 30, or 90 days depending on nationality.`;
    if (v.includes("work")) return `${ctx}a Japan Work Visa issued under a specific status of residence (e.g., Engineer, Specialist in Humanities). Requires employer sponsorship and a Certificate of Eligibility.`;
    if (v.includes("student")) return `${ctx}a Japan Student Visa (ryugaku) for studying at a Japanese educational institution. Requires a Certificate of Eligibility and acceptance from a recognized school.`;
    return `${ctx}a Japanese visa issued under Japan's immigration system. Requirements and duration vary by purpose — tourism, work, study, or cultural activities.`;
  }

  // eVisa / ETA / Visa on arrival
  if (v.includes("evisa") || v.includes("e-visa") || v.includes("electronic visa")) return `${ctx}an electronic visa (eVisa) applied for and issued online, eliminating the need to visit an embassy or consulate. Typically linked to your passport electronically.`;
  if (v.includes("eta") || v.includes("electronic travel auth")) return `${ctx}an Electronic Travel Authorization (ETA) — a lightweight pre-screening requirement for visa-exempt travelers. Applied for online, usually approved within minutes.`;
  if (v.includes("visa on arrival") || v.includes("voa")) return `${ctx}a visa issued at the port of entry upon arrival. Typically available for short tourism or business visits. Requirements and fees vary by nationality and destination.`;
  if (v.includes("visa free") || v.includes("visa-free")) return `${tripContext ? `For your ${tripContext.days}-day ${tripContext.purpose} travel from ${tripContext.origin} to ${tripContext.destination}, no visa is required.` : "No visa required for this corridor."} Your passport grants visa-free entry for short stays. Check the maximum duration and any registration requirements after arrival.`;

  // Australia / Canada / India
  if (v.includes("australia") || v.includes("australian")) return `${ctx}an Australian visa — requirements vary by subclass. Common types include Visitor (subclass 600), Student (subclass 500), and Skilled Worker (subclass 482).`;
  if (v.includes("canada") || v.includes("canadian")) return `${ctx}a Canadian visa — requirements vary by type. Common categories include Temporary Resident Visa (visitor), Study Permit, and Work Permit.`;
  if (v.includes("india") || v.includes("indian")) return `${ctx}an Indian visa — available as eVisa (eTourist, eBusiness, eMedical) or traditional sticker visa. eVisas are processed online; traditional visas require consular application.`;

  // Generic by purpose
  if (v.includes("business")) return `${ctx}a business visa permitting attendance at meetings, conferences, negotiations, and professional events. Does not typically authorize employment. Duration and conditions vary by country.`;
  if (v.includes("tourist") || v.includes("tourism")) return `${ctx}a tourist visa for leisure travel, sightseeing, and visiting friends or family. Does not permit employment. Duration varies by destination country.`;
  if (v.includes("student") || v.includes("study")) return `${ctx}a student visa for enrolling in an educational program at a recognized institution. Typically requires proof of acceptance, financial support, and health insurance.`;
  if (v.includes("work")) return `${ctx}a work visa authorizing employment in the destination country. Usually requires employer sponsorship, a job offer, and proof of qualifications.`;
  if (v.includes("transit")) return `${ctx}a transit visa for passing through a country en route to a final destination. Required by some nationalities even for short airport layovers.`;
  if (v.includes("medical")) return `${ctx}a medical visa for traveling to receive medical treatment abroad. Typically requires documentation from the treating facility and proof of financial means.`;
  if (v.includes("family") || v.includes("spouse") || v.includes("dependent")) return `${ctx}a family/dependent visa for joining or accompanying a family member in the destination country. Requires proof of relationship and the primary visa holder's status.`;
  if (v.includes("digital nomad") || v.includes("remote work")) return `${ctx}a digital nomad or remote work visa allowing foreign nationals to live and work remotely for employers outside the destination country. A growing category with varying rules per country.`;

  // Fallback
  return `${ctx}a travel visa required for entry to the destination country. Requirements, fees, and processing times vary based on your nationality, purpose of travel, and intended duration of stay.`;
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
  const [reauditProgress, setReauditProgress] = useState<ReauditProgress | null>(null);
  const [reauditThinking, setReauditThinking] = useState<Map<string, string>>(new Map());

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

  // Handle "Apply Fixes & Re-check" — in-modal sequential per-doc re-verification
  const handleApplyFixes = useCallback(async () => {
    if (!remediationData || !result?.requirements) return;

    // Initialize re-audit progress
    const initialStatuses = new Map<string, ReauditFixStatus>();
    for (const fix of remediationData.fixes) {
      initialStatuses.set(fix.id, "pending");
    }
    const progress: ReauditProgress = {
      fixStatuses: new Map(initialStatuses),
      fixResults: new Map(),
      overallComplete: false,
      allPassed: false,
    };
    setReauditProgress({ ...progress });
    setReauditThinking(new Map());

    // Accumulate extractions across fixes for cross-doc validation
    const accumulatedExtractions = [...perDocExtractions];

    // Process each fix sequentially
    for (const fix of remediationData.fixes) {
      try {
        // 1. Update status to "fetching"
        progress.fixStatuses.set(fix.id, "fetching");
        setReauditProgress({ ...progress, fixStatuses: new Map(progress.fixStatuses) });

        // 2. Fetch the corrected doc image
        const correctedDoc = await fetchDemoDocument(
          { name: fix.correctedDocName, language: fix.correctedDocLanguage, image: fix.correctedDocImage },
          remediationData.fixes.indexOf(fix)
        );

        // 3. Find the matching RequirementItem
        const requirement = result.requirements.items.find(
          (r) => r.name === fix.requirementName
        );
        if (!requirement) {
          if (isDevelopment()) {
            console.warn(`[Re-audit] No matching requirement for "${fix.requirementName}"`);
          }
          progress.fixStatuses.set(fix.id, "failed");
          progress.fixResults.set(fix.id, {
            requirement: fix.requirementName,
            status: "not_checked",
            detail: "Could not find matching requirement",
          });
          setReauditProgress({ ...progress, fixStatuses: new Map(progress.fixStatuses), fixResults: new Map(progress.fixResults) });
          continue;
        }

        // 4. Update status to "analyzing"
        progress.fixStatuses.set(fix.id, "analyzing");
        setReauditProgress({ ...progress, fixStatuses: new Map(progress.fixStatuses) });

        // 5. Call POST /api/analyze/document
        const response = await fetch("/api/analyze/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: correctedDoc,
            requirement,
            previousExtractions: accumulatedExtractions,
          }),
        });

        if (!response.ok || !response.body) {
          progress.fixStatuses.set(fix.id, "failed");
          progress.fixResults.set(fix.id, {
            requirement: fix.requirementName,
            status: "not_checked",
            detail: "Analysis request failed",
          });
          setReauditProgress({ ...progress, fixStatuses: new Map(progress.fixStatuses), fixResults: new Map(progress.fixResults) });
          continue;
        }

        // 6. Process SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalCompliance: ComplianceItem | null = null;

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
              if (data === "[DONE]") continue;

              try {
                const event = JSON.parse(data) as SSEEvent;

                // Capture thinking updates
                if (event.type === "doc_analysis_thinking") {
                  setReauditThinking((prev) => {
                    const next = new Map(prev);
                    next.set(fix.id, event.excerpt);
                    return next;
                  });
                }

                // Capture final result
                if (event.type === "doc_analysis_result") {
                  finalCompliance = event.compliance;
                  // Add extraction to accumulator for cross-doc validation
                  if (event.extraction) {
                    accumulatedExtractions.push(event.extraction);
                  }
                }
              } catch {
                if (isDevelopment()) {
                  console.warn("[Re-audit] Failed to parse SSE event:", data);
                }
              }
            }
          }
        }

        // 7. Update status based on compliance result
        if (finalCompliance) {
          const passed = finalCompliance.status === "met";
          progress.fixStatuses.set(fix.id, passed ? "passed" : "failed");
          progress.fixResults.set(fix.id, finalCompliance);
        } else {
          progress.fixStatuses.set(fix.id, "failed");
          progress.fixResults.set(fix.id, {
            requirement: fix.requirementName,
            status: "not_checked",
            detail: "No compliance result received",
          });
        }
        setReauditProgress({ ...progress, fixStatuses: new Map(progress.fixStatuses), fixResults: new Map(progress.fixResults) });

      } catch (err) {
        if (isDevelopment()) {
          console.error(`[Re-audit] Error processing fix ${fix.id}:`, err);
        }
        progress.fixStatuses.set(fix.id, "failed");
        setReauditProgress({ ...progress, fixStatuses: new Map(progress.fixStatuses) });
      }
    }

    // 8. All fixes processed — finalize
    const allPassed = Array.from(progress.fixResults.values()).every((c) => c.status === "met");
    progress.overallComplete = true;
    progress.allPassed = allPassed;
    setReauditProgress({ ...progress, fixStatuses: new Map(progress.fixStatuses), fixResults: new Map(progress.fixResults) });

    // Update advisory report if all passed
    if (allPassed && advisoryReport) {
      setAdvisoryReport({
        ...advisoryReport,
        overall: "APPLICATION_PROCEEDS",
      });
    }

    if (isDevelopment()) {
      console.log(`[Re-audit] Complete. All passed: ${allPassed}`);
    }
  }, [remediationData, result?.requirements, perDocExtractions, advisoryReport]);

  // Derived: is re-audit in progress?
  const isReauditing = !!reauditProgress && !reauditProgress.overallComplete;
  const reauditComplete = !!reauditProgress?.overallComplete && reauditProgress.allPassed;

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
        reauditProgress={reauditProgress}
        reauditThinking={reauditThinking}
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
  reauditProgress,
  reauditThinking,
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
  reauditProgress: ReauditProgress | null;
  reauditThinking: Map<string, string>;
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

  // For demo profiles, get multi-language intro texts
  const multiLanguageIntros = isDemoProfile && loadedPersonaName
    ? getMultiLanguageIntroTexts(travelDetails.passports[0], dest, purpose, loadedPersonaName)
    : null;

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

  // Auto-open the advisory modal as soon as the assessment is ready
  const advisoryAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (advisoryAgentComplete && advisoryReport && !advisoryAutoOpenedRef.current) {
      advisoryAutoOpenedRef.current = true;
      setShowAdvisoryModal(true);
    }
  }, [advisoryAgentComplete, advisoryReport, setShowAdvisoryModal]);

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
        {/* Top toolbar — back button + language selector */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("Back to Home")}
          </button>
          <LanguageSelector
            currentLanguage={language}
            onLanguageChange={setLanguage}
            isTranslating={isTranslating}
            suggestedLanguage={suggestedLanguage || undefined}
            passports={travelDetails.passports}
            destination={travelDetails.destination}
          />
        </div>

      {/* Header — corridor card */}
      <section className="mb-6 rounded-xl border border-border/60 bg-card/50">
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          {/* Row 1: Corridor hero — big flags, big names */}
          <div className="flex items-center gap-5 sm:gap-8">
            {/* Origin */}
            <div className="flex items-center gap-3">
              <span className="text-5xl sm:text-6xl" aria-hidden="true">{countryFlag(travelDetails.passports[0])}</span>
              <p className="text-xl sm:text-2xl font-bold leading-tight">{travelDetails.passports[0]}</p>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center px-1">
              <svg className="w-8 h-8 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>

            {/* Destination */}
            <div className="flex items-center gap-3">
              <span className="text-5xl sm:text-6xl" aria-hidden="true">{countryFlag(travelDetails.destination)}</span>
              <p className="text-xl sm:text-2xl font-bold leading-tight">{travelDetails.destination}</p>
            </div>
          </div>

          {/* Row 2: Unified context line — purpose · duration · dates · travelers · visa type */}
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="capitalize font-medium text-foreground/80">{t(travelDetails.purpose)}</span>
            <span className="text-border/60">&middot;</span>
            <span>{tripDays} {t("days")}</span>
            <span className="text-border/60">&middot;</span>
            <span>{formatDateRange(travelDetails.dates.depart, travelDetails.dates.return)}</span>
            <span className="text-border/60">&middot;</span>
            <span>{travelDetails.travelers} {travelDetails.travelers === 1 ? t("traveler") : t("travelers")}</span>
            {result?.requirements && (
              <>
                <span className="text-border/60">&middot;</span>
                <span className="relative group">
                  <span className="font-medium text-blue-600 dark:text-blue-400 cursor-help border-b border-dashed border-blue-400/40">
                    {translatedCorridorInfo?.visaType || result.requirements.visaType}
                  </span>
                  {/* Visa info tooltip */}
                  <span className="pointer-events-none group-hover:pointer-events-auto absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-popover p-4 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-left">
                    {/* Title */}
                    <span className="block text-sm font-semibold text-foreground">
                      {translatedCorridorInfo?.visaType || result.requirements.visaType}
                    </span>
                    {/* Description — contextualized to the traveler's trip */}
                    <span className="block mt-1.5 text-xs leading-relaxed text-muted-foreground first-letter:uppercase">
                      {getVisaDescription(result.requirements.visaType, {
                        origin: travelDetails.passports[0],
                        destination: travelDetails.destination,
                        purpose: travelDetails.purpose,
                        days: tripDays,
                      })}
                    </span>
                    {/* Details grid — order: Apply at, Fee, Processing, Window */}
                    {(result.requirements.fees?.visa || result.requirements.processingTime || result.requirements.applyAt) && (
                      <span className="block mt-3 pt-3 border-t border-border/60">
                        <span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                          {/* Apply at — with hyperlink when URL available */}
                          {result.requirements.applyAt && (
                            <>
                              <span className="text-muted-foreground">Apply at</span>
                              <span className="text-foreground">
                                {result.requirements.applyAtUrl ? (
                                  <a href={result.requirements.applyAtUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline underline-offset-2 decoration-blue-400/40 hover:decoration-blue-500 transition-colors">
                                    {result.requirements.applyAt}
                                  </a>
                                ) : (
                                  result.requirements.applyAt
                                )}
                              </span>
                            </>
                          )}
                          {/* Fee — visa fee and service fee on separate lines */}
                          {result.requirements.fees?.visa && (
                            <>
                              <span className="text-muted-foreground">Fee</span>
                              <span className="text-foreground">
                                <span className="block">{result.requirements.fees.visa}</span>
                                {result.requirements.fees.service && (
                                  <span className="block text-muted-foreground mt-0.5">+ {result.requirements.fees.service}</span>
                                )}
                              </span>
                            </>
                          )}
                          {result.requirements.processingTime && (
                            <>
                              <span className="text-muted-foreground">Processing</span>
                              <span className="text-foreground">{result.requirements.processingTime}</span>
                            </>
                          )}
                          {result.requirements.applicationWindow && (
                            <>
                              <span className="text-muted-foreground">Window</span>
                              <span className="text-foreground">{result.requirements.applicationWindow.earliest} – {result.requirements.applicationWindow.latest}</span>
                            </>
                          )}
                        </span>
                      </span>
                    )}
                    {/* Arrow */}
                    <span className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rotate-45 border-l border-t border-border bg-popover" />
                  </span>
                </span>
              </>
            )}
          </div>

          {/* Row 3: Contextual intro */}
          {multiLanguageIntros ? (
            <div className="mt-3 space-y-3">
              {multiLanguageIntros.map((intro, idx) => {
                const colorClass = intro.color === "blue"
                  ? "text-blue-600 dark:text-blue-400"
                  : intro.color === "purple"
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-emerald-600 dark:text-emerald-400";

                return (
                  <div key={idx} className={idx > 0 ? "pt-3 border-t border-border/50" : ""}>
                    <p className={`text-[10px] uppercase tracking-wider mb-1 font-semibold ${colorClass}`}>
                      {intro.language}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {intro.text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {introText}
            </p>
          )}
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

      {/* Progress narration and live activity replaced by FloatingAgentStatus (rendered below, outside scroll flow) */}

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
          ADVISORY RE-OPEN — compact link to re-open the assessment modal
          (modal auto-opens on completion; this is for re-opening after close)
          ══════════════════════════════════════════════════════════════ */}
      {advisoryAgentComplete && advisoryReport && !showAdvisoryModal && !reauditComplete && (
        <div className="mt-4 flex justify-end animate-in fade-in duration-300">
          <button
            type="button"
            onClick={() => setShowAdvisoryModal(true)}
            className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors"
          >
            {t("View Assessment")}
          </button>
        </div>
      )}

      {/* Re-audit success is now shown inside the AdvisoryModal */}

      {/* Fix Wizard is now embedded inside the AdvisoryModal — no standalone panel needed */}

      {/* Advisory Modal — opened via CTA button, not auto-popup */}
      {advisoryReport && (
        <AdvisoryModal
          advisory={advisoryReport}
          isOpen={showAdvisoryModal}
          onClose={() => setShowAdvisoryModal(false)}
          documentImages={documentImages}
          extractions={perDocExtractions}
          remediation={remediationData}
          onApplyFixes={onApplyFixes}
          isReauditing={isReauditing}
          reauditProgress={reauditProgress}
          reauditThinking={reauditThinking}
        />
      )}
    </div>
    </div>

    {/* ══════════════════════════════════════════════════════════════
        FLOATING AGENT STATUS — contextual status bar during doc verification
        ══════════════════════════════════════════════════════════════ */}
    <FloatingAgentStatus
      events={events}
      totalDocs={totalUploadableReqs}
      advisoryComplete={advisoryAgentComplete}
      advisoryRunning={isAdvisoryRunning}
      isModalOpen={showAdvisoryModal}
    />
    </>
  );
}
