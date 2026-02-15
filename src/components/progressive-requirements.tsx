"use client";

/**
 * Progressive Requirements Display with Per-Requirement Upload
 *
 * Each requirement is an interactive row with:
 * - Requirement info (left)
 * - Upload zone (right) for uploadable requirements
 * - Status: pending → uploaded → analyzing → passed/flagged
 * - Inline thinking + result display per requirement
 *
 * All visible text goes through t() for translation support.
 */

import {
  SSEEvent,
  RequirementItem,
  ComplianceItem,
  DocumentExtraction,
  CrossDocFinding,
  RequirementsChecklist,
} from "@/lib/types";
import { useTranslation } from "@/lib/i18n-context";
import { useDemoContext } from "@/lib/demo-context";
import { LANGUAGES } from "@/components/language-selector";
import {
  CheckCircle2,
  AlertCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  Info,
  DollarSign,
  Calendar,
  Eye,
  Globe,
  Plus,
  Minus,
} from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

type RequirementStatus =
  | "pending"
  | "uploaded"
  | "analyzing"
  | "passed"
  | "warning"
  | "flagged"
  | "error";

interface RequirementState {
  status: RequirementStatus;
  file?: File;
  thinking?: string;
  compliance?: ComplianceItem;
  crossDocFindings?: CrossDocFinding[];
  extraction?: DocumentExtraction;
}

interface ProgressiveRequirementsProps {
  events: SSEEvent[];
  isStreaming: boolean;
  compliance?: ComplianceItem[];
  corridorInfo?: { corridor: string; visaType: string };
  onAllDocumentsAnalyzed?: (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => void;
  onPartialDocumentsAnalyzed?: (extractions: DocumentExtraction[], compliances: ComplianceItem[]) => void;
  onDocumentImageCaptured?: (images: Map<string, { base64: string; mimeType: string }>) => void;
  isDemoProfile?: boolean;
  demoDocuments?: Array<{ name: string; language: string; image: string }>;
}

/**
 * Get multi-language greetings for demo personas.
 * Returns greetings in order with color coding to match header pattern:
 * blue (Every document) → purple (Every detail) → emerald (Every language)
 *
 * When `currentDocName` is provided, the "verifying" message shows
 * what the agent is currently working on instead of a generic counter.
 */
function getPersonaGreetings(
  personaName: string,
  firstName: string,
  messageType: "passport" | "verifying" | "complete",
  analyzedCount: number,
  totalRequirements: number,
  currentDocName?: string | null
): Array<{ language: string; color: "blue" | "purple" | "emerald"; text: string }> | null {
  const greetings: Array<{ language: string; color: "blue" | "purple" | "emerald"; text: string }> = [];

  // Build contextual verifying message — shows what agent is doing right now
  const enVerifying = currentDocName
    ? `${firstName}, analyzing your ${currentDocName} now — ${analyzedCount} of ${totalRequirements} documents verified so far.`
    : `${firstName}, verifying your documents — ${analyzedCount} of ${totalRequirements} checked.`;

  // Priya Sharma - India → Germany
  // Order: English (blue) → Hindi (purple) → German (emerald)
  if (personaName === "Priya Sharma") {
    const hiVerifying = currentDocName
      ? `${firstName}, अभी आपके ${currentDocName} का विश्लेषण कर रहे हैं — ${totalRequirements} में से ${analyzedCount} दस्तावेज़ सत्यापित।`
      : `${firstName}, आपके दस्तावेज़ सत्यापित कर रहे हैं — ${totalRequirements} में से ${analyzedCount} जाँचे गए।`;
    const deVerifying = currentDocName
      ? `${firstName}, wir analysieren jetzt Ihr ${currentDocName} — ${analyzedCount} von ${totalRequirements} Dokumenten geprüft.`
      : `${firstName}, wir überprüfen Ihre Dokumente — ${analyzedCount} von ${totalRequirements} geprüft.`;

    if (messageType === "passport") {
      greetings.push(
        { language: "English", color: "blue", text: `Hello ${firstName}, thank you for uploading your passport. Please be patient while we read through and analyze the rest of your travel documents. We're here to help.` },
        { language: "Hindi (हिंदी)", color: "purple", text: `नमस्ते ${firstName}, आपका पासपोर्ट अपलोड करने के लिए धन्यवाद। कृपया धैर्य रखें जबकि हम आपके बाकी यात्रा दस्तावेज़ों को पढ़ते और विश्लेषण करते हैं। हम मदद के लिए यहां हैं।` },
        { language: "German (Deutsch)", color: "emerald", text: `Hallo ${firstName}, vielen Dank für das Hochladen Ihres Reisepasses. Bitte haben Sie Geduld, während wir Ihre restlichen Reisedokumente durchsehen und analysieren. Wir sind hier, um zu helfen.` }
      );
    } else if (messageType === "verifying") {
      greetings.push(
        { language: "English", color: "blue", text: enVerifying },
        { language: "Hindi (हिंदी)", color: "purple", text: hiVerifying },
        { language: "German (Deutsch)", color: "emerald", text: deVerifying }
      );
    } else {
      greetings.push(
        { language: "English", color: "blue", text: `${firstName}, all ${totalRequirements} documents have been verified. Review your results below.` },
        { language: "Hindi (हिंदी)", color: "purple", text: `${firstName}, सभी ${totalRequirements} दस्तावेज़ सत्यापित हो गए हैं। नीचे अपने परिणाम देखें।` },
        { language: "German (Deutsch)", color: "emerald", text: `${firstName}, alle ${totalRequirements} Dokumente wurden überprüft. Überprüfen Sie Ihre Ergebnisse unten.` }
      );
    }
  }
  // Carlos Mendes - Brazil → Japan
  // Order: Portuguese (blue) → English (purple) → Japanese (emerald)
  else if (personaName === "Carlos Mendes") {
    const ptVerifying = currentDocName
      ? `${firstName}, analisando seu ${currentDocName} agora — ${analyzedCount} de ${totalRequirements} documentos verificados.`
      : `${firstName}, verificando seus documentos — ${analyzedCount} de ${totalRequirements} verificados.`;
    const jaVerifying = currentDocName
      ? `${firstName}さん、${currentDocName}を分析中 — ${totalRequirements}件中${analyzedCount}件の書類を確認済み。`
      : `${firstName}さん、書類を確認中 — ${totalRequirements}件中${analyzedCount}件確認済み。`;

    if (messageType === "passport") {
      greetings.push(
        { language: "Portuguese (Português)", color: "blue", text: `Olá ${firstName}, obrigado por enviar seu passaporte. Por favor, tenha paciência enquanto lemos e analisamos o restante de seus documentos de viagem. Estamos aqui para ajudar.` },
        { language: "English", color: "purple", text: `Hello ${firstName}, thank you for uploading your passport. Please be patient while we read through and analyze the rest of your travel documents. We're here to help.` },
        { language: "Japanese (日本語)", color: "emerald", text: `こんにちは${firstName}さん、パスポートをアップロードしていただきありがとうございます。残りの旅行書類を読んで分析しますので、しばらくお待ちください。お手伝いします。` }
      );
    } else if (messageType === "verifying") {
      greetings.push(
        { language: "Portuguese (Português)", color: "blue", text: ptVerifying },
        { language: "English", color: "purple", text: enVerifying },
        { language: "Japanese (日本語)", color: "emerald", text: jaVerifying }
      );
    } else {
      greetings.push(
        { language: "Portuguese (Português)", color: "blue", text: `${firstName}, todos os ${totalRequirements} documentos foram verificados. Revise seus resultados abaixo.` },
        { language: "English", color: "purple", text: `${firstName}, all ${totalRequirements} documents have been verified. Review your results below.` },
        { language: "Japanese (日本語)", color: "emerald", text: `${firstName}さん、すべての${totalRequirements}件の書類が確認されました。以下で結果を確認してください。` }
      );
    }
  }
  // Amara Okafor - Nigeria → UK
  // Order: English (blue) → Yoruba (purple) → British English (emerald)
  else if (personaName === "Amara Okafor") {
    const yoVerifying = currentDocName
      ? `${firstName}, a n ṣe itupalẹ ${currentDocName} rẹ bayi — ${analyzedCount} ninu ${totalRequirements} ti a ṣayẹwo.`
      : `${firstName}, a n ṣe ijẹrisi awọn iwe rẹ — ${analyzedCount} ninu ${totalRequirements} ti a ṣayẹwo.`;
    const brVerifying = currentDocName
      ? `${firstName}, analysing your ${currentDocName} now — ${analyzedCount} of ${totalRequirements} documents verified.`
      : `${firstName}, verifying your documents — ${analyzedCount} of ${totalRequirements} checked.`;

    if (messageType === "passport") {
      greetings.push(
        { language: "English", color: "blue", text: `Hello ${firstName}, thank you for uploading your passport. Please be patient while we read through and analyze the rest of your travel documents. We're here to help.` },
        { language: "Yoruba", color: "purple", text: `Pẹlẹ o ${firstName}, o ṣeun fun gbigbe pasipọọti rẹ soke. Jọwọ ni suuru lakoko ti a ba ka ati ṣe itupalẹ awọn iwe irin-ajo rẹ to ku. A wa nibi lati ran ọ lọwọ.` },
        { language: "British English", color: "emerald", text: `Hello ${firstName}, thank you for uploading your passport. Please be patient whilst we read through and analyse the rest of your travel documents. We're here to help.` }
      );
    } else if (messageType === "verifying") {
      greetings.push(
        { language: "English", color: "blue", text: enVerifying },
        { language: "Yoruba", color: "purple", text: yoVerifying },
        { language: "British English", color: "emerald", text: brVerifying }
      );
    } else {
      greetings.push(
        { language: "English", color: "blue", text: `${firstName}, all ${totalRequirements} documents have been verified. Review your results below.` },
        { language: "Yoruba", color: "purple", text: `${firstName}, gbogbo awọn iwe ${totalRequirements} ti jẹrisi. Wo awọn abajade rẹ ni isalẹ.` },
        { language: "British English", color: "emerald", text: `${firstName}, all ${totalRequirements} documents have been verified. Review your results below.` }
      );
    }
  }

  return greetings.length > 0 ? greetings : null;
}

/**
 * Strict document matching with explicit type detection.
 * Prioritizes exact keyword matches and prevents common mismatches.
 */
function findBestDocumentMatch(
  requirementName: string,
  documents: Array<{ name: string; language: string; image: string }>
): { name: string; language: string; image: string } | null {
  const reqLower = requirementName.toLowerCase();
  const reqWords = reqLower.split(/\s+/);

  // Define explicit document types with keywords and exclusions
  // Order matters: more specific types must come before generic ones
  const documentTypes = {
    passport: {
      keywords: ["passport"],
      excludeIf: []
    },
    casLetter: {
      keywords: ["cas", "confirmation of acceptance"],
      excludeIf: []
    },
    personalStatement: {
      keywords: ["personal statement", "statement of purpose", "personal essay"],
      excludeIf: []
    },
    ielts: {
      keywords: ["ielts", "toefl", "pte", "language proficiency", "english proficiency", "english language"],
      excludeIf: []
    },
    academicQualifications: {
      keywords: ["academic", "transcript", "qualification", "degree", "certificate", "diploma"],
      excludeIf: ["tb", "tuberculosis", "medical", "birth"]
    },
    tbTest: {
      keywords: ["tuberculosis", "tb test", "tb certificate", "medical test", "medical exam"],
      excludeIf: []
    },
    accommodation: {
      keywords: ["accommodation", "hotel", "lodging", "booking"],
      excludeIf: ["flight", "ticket", "airline"]
    },
    bankStatement: {
      keywords: ["bank", "financial evidence", "financial means", "sufficient funds"],
      excludeIf: ["employment", "income", "tax", "return", "personal"]
    },
    incomeTaxReturns: {
      keywords: ["tax", "return", "itr"],
      excludeIf: []
    },
    employmentProof: {
      keywords: ["employment", "work", "employer", "income", "freelance"],
      excludeIf: ["tax", "return", "bank"]
    },
    flight: {
      keywords: ["flight", "ticket", "airline"],
      excludeIf: ["hotel", "accommodation"]
    },
    travelItinerary: {
      keywords: ["itinerary", "travel plan", "trip plan"],
      excludeIf: []
    },
    insurance: {
      keywords: ["insurance", "coverage", "policy"],
      excludeIf: []
    },
    coverLetter: {
      keywords: ["cover letter"],
      excludeIf: ["employment", "invitation", "bank"]
    },
    invitation: {
      keywords: ["invitation", "invite"],
      excludeIf: []
    }
  };

  // Detect requirement type
  let reqType: string | null = null;
  for (const [type, config] of Object.entries(documentTypes)) {
    const hasKeyword = config.keywords.some(kw => reqWords.includes(kw) || reqLower.includes(kw));
    const hasExclusion = config.excludeIf.some(ex => reqWords.includes(ex) || reqLower.includes(ex));
    if (hasKeyword && !hasExclusion) {
      reqType = type;
      break;
    }
  }

  if (!reqType) {
    console.log(`[Auto-upload Match] Could not detect type for "${requirementName}"`);
    return null;
  }

  // Find document matching the detected type
  for (const doc of documents) {
    const docLower = doc.name.toLowerCase();
    const docWords = docLower.split(/\s+/);
    const config = documentTypes[reqType as keyof typeof documentTypes];

    const hasKeyword = config.keywords.some(kw => docWords.includes(kw) || docLower.includes(kw));
    const hasExclusion = config.excludeIf.some(ex => docWords.includes(ex) || docLower.includes(ex));

    if (hasKeyword && !hasExclusion) {
      console.log(`[Auto-upload Match] Matched "${doc.name}" to "${requirementName}" (type: ${reqType})`);
      return doc;
    }
  }

  console.log(`[Auto-upload Match] No match found for "${requirementName}" (type: ${reqType})`);
  return null;
}

/**
 * Stacked multi-language greeting component with color-coded labels
 */
function CompactGreeting({
  multiLanguageGreetings,
  greetingText,
  language,
  setLanguage,
  t,
}: {
  multiLanguageGreetings: Array<{ language: string; color: "blue" | "purple" | "emerald"; text: string }> | null;
  greetingText: string | null;
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}) {
  const greetingRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep next requirement visible when greeting appears
  useEffect(() => {
    if (greetingRef.current) {
      // Small delay to let the animation settle
      setTimeout(() => {
        // Find the second requirement (index 1)
        const secondReq = document.getElementById("requirement-1");
        if (secondReq) {
          const rect = secondReq.getBoundingClientRect();
          // If the second requirement is below the fold, scroll to keep it visible
          if (rect.top > window.innerHeight - 100) {
            secondReq.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }, 600);
    }
  }, []);

  if (multiLanguageGreetings) {
    return (
      <div
        ref={greetingRef}
        className="rounded-lg border border-border bg-card/60 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-700"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-3">
            {multiLanguageGreetings.map((greeting, idx) => {
              const colorClass = greeting.color === "blue"
                ? "text-blue-600 dark:text-blue-400"
                : greeting.color === "purple"
                ? "text-purple-600 dark:text-purple-400"
                : "text-emerald-600 dark:text-emerald-400";

              return (
                <div key={idx} className={idx > 0 ? "pt-3 border-t border-border/50" : ""}>
                  <p className={`text-[10px] uppercase tracking-wider mb-1 font-semibold ${colorClass}`}>
                    {greeting.language}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {greeting.text}
                  </p>
                </div>
              );
            })}
          </div>
          <InlineLanguageSwitch language={language} setLanguage={setLanguage} t={t} />
        </div>
      </div>
    );
  }

  // Single language greeting (non-demo)
  return (
    <div
      ref={greetingRef}
      className="flex items-start gap-3 rounded-lg border border-border bg-card/60 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-700"
    >
      <p className="text-sm text-foreground leading-relaxed flex-1">
        {greetingText}
      </p>
      <InlineLanguageSwitch language={language} setLanguage={setLanguage} t={t} />
    </div>
  );
}

export function ProgressiveRequirements({
  events,
  isStreaming,
  compliance,
  corridorInfo,
  onAllDocumentsAnalyzed,
  onPartialDocumentsAnalyzed,
  onDocumentImageCaptured,
  isDemoProfile = false,
  demoDocuments = [],
}: ProgressiveRequirementsProps) {
  const { t, tDynamic, language, setLanguage, isTranslating, translatedRequirements, translatedCorridorInfo } = useTranslation();
  const { requestSidebarExpand, setSidebarOpen, loadedPersonaName } = useDemoContext();
  const sidebarExpandTriggeredRef = useRef(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [requirementStates, setRequirementStates] = useState<
    Map<number, RequirementState>
  >(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);
  const manualUploadCountRef = useRef(0);
  const manuallyUploadedIndicesRef = useRef<Set<number>>(new Set());
  const autoUploadTriggeredRef = useRef(false);
  const partialAdvisoryTriggeredRef = useRef(false);

  // Debug: Log props on mount and when they change
  useEffect(() => {
    console.log(`[ProgressiveRequirements] Props updated:`, {
      isDemoProfile,
      demoDocumentsLength: demoDocuments.length,
      demoDocuments: demoDocuments.map(d => d.name),
    });
  }, [isDemoProfile, demoDocuments]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  // Traveler name extracted from passport — shown in greeting
  const [travelerFirstName, setTravelerFirstName] = useState<string | null>(null);
  // Client-side mount flag to prevent hydration errors
  const [hasMounted, setHasMounted] = useState(false);

  // Set mounted flag on client-side
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Track all extractions for cross-document checking
  const extractionsRef = useRef<DocumentExtraction[]>([]);
  // Track document images (base64) keyed by docType for advisory annotation
  const documentImagesRef = useRef<Map<string, { base64: string; mimeType: string }>>(new Map());
  // Stable ref for the callback (avoids stale closure in handleFileUpload's useCallback)
  const onDocImageCapturedRef = useRef(onDocumentImageCaptured);
  useEffect(() => {
    onDocImageCapturedRef.current = onDocumentImageCaptured;
  }, [onDocumentImageCaptured]);

  // Clear drag-over state when drag ends anywhere (e.g. cancelled drop)
  useEffect(() => {
    const handleDragEnd = () => setDragOverIndex(null);
    document.addEventListener("dragend", handleDragEnd);
    return () => document.removeEventListener("dragend", handleDragEnd);
  }, []);

  // Build a map from source name → URL using search_status and sources events.
  // Also supports fuzzy matching (substring) for when the model names sources
  // slightly differently in requirements vs search events.
  const sourceUrlMap = useMemo(() => {
    const exactMap = new Map<string, string>();
    for (const e of events) {
      if (e.type === "search_status" && e.url && e.source) {
        exactMap.set(e.source, e.url);
      }
      if (e.type === "sources") {
        for (const src of e.sources) {
          if (src.name && src.url) {
            exactMap.set(src.name, src.url);
          }
        }
      }
    }
    // Return a proxy-like getter that falls back to substring matching
    return {
      get(name: string): string | undefined {
        if (exactMap.has(name)) return exactMap.get(name);
        // Fuzzy: check if any key contains the name or vice versa
        const lower = name.toLowerCase();
        for (const [key, url] of exactMap) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes(lower) || lower.includes(keyLower)) {
            return url;
          }
        }
        return undefined;
      },
    };
  }, [events]);

  // Build requirements list from SSE "requirement" events — only uploadable items
  const requirements = useMemo(() => {
    const all = events
      .filter((e) => e.type === "requirement")
      .map((e) => {
        if (e.type === "requirement") {
          return {
            name: e.item,
            description: e.detail || "",
            required: e.depth != null && e.depth > 1,
            source: e.source,
            confidence: "high" as const,
            personalizedDetail: undefined,
            uploadable: e.uploadable ?? true,
            universal: e.universal ?? false,
          };
        }
        return null;
      })
      .filter(Boolean) as RequirementItem[];
    return all.filter((r) => r.uploadable);
  }, [events]);

  const totalRequirements = requirements.length;
  const analyzedCount = Array.from(requirementStates.values()).filter(
    (s) => s.status === "passed" || s.status === "warning" || s.status === "flagged"
  ).length;

  // Reset refs when requirements change (new analysis started)
  useEffect(() => {
    manualUploadCountRef.current = 0;
    manuallyUploadedIndicesRef.current.clear();
    autoUploadTriggeredRef.current = false;
    partialAdvisoryTriggeredRef.current = false;
    documentImagesRef.current.clear();
    setTravelerFirstName(null);
  }, [totalRequirements]);

  // EARLY TRIGGER: Start advisory after most documents analyzed (80-90%)
  // This provides parallel execution benefit while ensuring advisory has enough data to be accurate
  useEffect(() => {
    // Only trigger for demo profiles with many documents
    if (!isDemoProfile || totalRequirements < 6) return;
    if (partialAdvisoryTriggeredRef.current) return;

    // Wait for 80% of documents OR all but the last 1-2 documents (whichever is more)
    // For 9 docs: Math.max(7, 9-2) = 7 documents (waits for 7/9 = 78%)
    const eightyPercent = Math.floor(totalRequirements * 0.8);
    const allButTwo = totalRequirements - 2;
    const threshold = Math.max(eightyPercent, allButTwo);

    if (analyzedCount >= threshold && onPartialDocumentsAnalyzed) {
      console.log(`[Early Advisory] Triggering after ${analyzedCount}/${totalRequirements} documents (threshold: ${threshold})`);
      const partialExtractions = extractionsRef.current;
      const partialCompliances = Array.from(requirementStates.values())
        .filter((s) => s.compliance)
        .map((s) => s.compliance!);

      partialAdvisoryTriggeredRef.current = true;
      onPartialDocumentsAnalyzed(partialExtractions, partialCompliances);
      // Flush document images so they're available when the advisory modal opens early
      if (documentImagesRef.current.size > 0) {
        onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));
      }
    }
  }, [analyzedCount, totalRequirements, requirementStates, onPartialDocumentsAnalyzed, isDemoProfile]);

  // Check if all documents are analyzed — triggers advisory agent (fallback for non-demo)
  useEffect(() => {
    if (totalRequirements > 0 && analyzedCount === totalRequirements && onAllDocumentsAnalyzed) {
      const allExtractions = extractionsRef.current;
      const allCompliances = Array.from(requirementStates.values())
        .filter((s) => s.compliance)
        .map((s) => s.compliance!);
      onAllDocumentsAnalyzed(allExtractions, allCompliances);
      // Also flush final document images to ensure they're available for the advisory modal
      if (documentImagesRef.current.size > 0) {
        onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));
      }
    }
  }, [analyzedCount, totalRequirements, requirementStates, onAllDocumentsAnalyzed]);

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const getComplianceStatus = (
    itemName: string
  ): "met" | "warning" | "critical" | "not_checked" => {
    if (!compliance) return "not_checked";
    const match = compliance.find(
      (c) =>
        c.requirement.toLowerCase().includes(itemName.toLowerCase()) ||
        itemName.toLowerCase().includes(c.requirement.toLowerCase())
    );
    return match?.status || "not_checked";
  };

  // Handle file upload for a specific requirement
  const handleFileUpload = useCallback(
    async (index: number, file: File): Promise<void> => {
      const requirement = requirements[index];
      if (!requirement) return;

      // Validate file
      const validTypes = ["image/png", "image/jpeg"];
      if (!validTypes.includes(file.type)) {
        setRequirementStates((prev) => {
          const next = new Map(prev);
          next.set(index, { status: "error", file });
          return next;
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setRequirementStates((prev) => {
          const next = new Map(prev);
          next.set(index, { status: "error", file });
          return next;
        });
        return;
      }

      // Convert to base64
      const base64 = await fileToBase64(file);

      // Store base64 for advisory document annotation (keyed by requirement name initially)
      documentImagesRef.current.set(requirement.name, { base64, mimeType: file.type });
      onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));

      // Update state: uploaded → analyzing
      setRequirementStates((prev) => {
        const next = new Map(prev);
        next.set(index, { status: "analyzing", file, thinking: "Reading document..." });
        return next;
      });

      // Demo shortcut: set traveler name immediately when passport is dropped
      // (no need to wait for extraction — we already know the persona name)
      if (
        isDemoProfile &&
        loadedPersonaName &&
        !travelerFirstName &&
        requirement.name.toLowerCase().includes("passport")
      ) {
        const demoFirstName = loadedPersonaName.split(" ")[0];
        if (demoFirstName) setTravelerFirstName(demoFirstName);
      }

      // Expand the item to show inline thinking
      setExpandedItems((prev) => new Set(prev).add(index));

      // Track manual uploads for demo auto-complete feature IMMEDIATELY on drop
      if (isDemoProfile && !autoUploadTriggeredRef.current) {
        manuallyUploadedIndicesRef.current.add(index);
        manualUploadCountRef.current += 1;
        console.log(`[Auto-upload] Manual upload count: ${manualUploadCountRef.current}, index: ${index}, isDemoProfile: ${isDemoProfile}, demoDocuments: ${demoDocuments.length}`);

        if (manualUploadCountRef.current === 1) {
          // After 1st upload, reopen the sidebar so user can drag the 2nd document
          setTimeout(() => setSidebarOpen(true), 800);
        }

        // After 2nd manual upload, close the demo sidebar and auto-upload remaining docs
        if (manualUploadCountRef.current === 2) {
          console.log(`[Auto-upload] Triggering auto-upload after 2nd document drop`);
          autoUploadTriggeredRef.current = true;
          // Close the demo sidebar — user has uploaded enough for the demo to take over
          setSidebarOpen(false);
          // Trigger auto-upload immediately
          setTimeout(() => autoUploadRemainingDocs(), 100);
        }
      }

      try {
        // Call per-document analysis endpoint
        const response = await fetch("/api/analyze/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: {
              id: `doc-${index}-${Date.now()}`,
              filename: file.name,
              base64,
              mimeType: file.type,
              sizeBytes: file.size,
            },
            requirement: {
              name: requirement.name,
              description: requirement.description,
              required: requirement.required,
              confidence: requirement.confidence,
            },
            previousExtractions: extractionsRef.current,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Stream the SSE response
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
              if (data === "[DONE]") break;

              try {
                const event = JSON.parse(data);

                if (event.type === "doc_analysis_thinking") {
                  setRequirementStates((prev) => {
                    const next = new Map(prev);
                    const current = next.get(index) || { status: "analyzing" as const, file };
                    next.set(index, { ...current, thinking: event.excerpt });
                    return next;
                  });
                }

                if (event.type === "doc_analysis_result") {
                  const complianceResult: ComplianceItem = event.compliance;
                  const newStatus: RequirementStatus =
                    complianceResult.status === "met"
                      ? "passed"
                      : complianceResult.status === "warning"
                        ? "warning"
                        : "flagged";

                  // Store extraction for future cross-checks
                  if (event.extraction) {
                    extractionsRef.current = [
                      ...extractionsRef.current,
                      event.extraction,
                    ];
                    // Also key the document image by docType for advisory annotation matching
                    const reqImageData = documentImagesRef.current.get(requirement.name);
                    if (reqImageData && event.extraction.docType) {
                      documentImagesRef.current.set(event.extraction.docType, reqImageData);
                      onDocImageCapturedRef.current?.(new Map(documentImagesRef.current));
                    }

                    // Extract traveler's first name from passport
                    if (
                      event.extraction.docType?.toLowerCase() === "passport" &&
                      !travelerFirstName &&
                      event.extraction.structuredData
                    ) {
                      const name = extractFirstName(event.extraction.structuredData);
                      if (name) setTravelerFirstName(name);
                    }
                  }

                  setRequirementStates((prev) => {
                    const next = new Map(prev);
                    const currentState = next.get(index);
                    next.set(index, {
                      status: newStatus,
                      file,
                      compliance: complianceResult,
                      crossDocFindings: event.crossDocFindings,
                      extraction: event.extraction,
                      thinking: currentState?.thinking, // Preserve thinking for transparency
                    });
                    return next;
                  });

                  // Auto-collapse clean passes after a brief delay
                  // Keep expanded if there are critical/warning cross-doc findings
                  if (complianceResult.status === "met") {
                    const hasIssues = event.crossDocFindings?.some(
                      (f: CrossDocFinding) => f.severity === "critical" || f.severity === "warning"
                    );
                    if (!hasIssues) {
                      setTimeout(() => {
                        setExpandedItems((prev) => {
                          const next = new Set(prev);
                          next.delete(index);
                          return next;
                        });
                      }, 2000);
                    }
                  }

                  // Auto-scroll to show the next requirement after this one completes
                  if (index + 1 < requirements.length) {
                    setTimeout(() => {
                      const el = document.getElementById(`requirement-${index + 1}`);
                      if (el) {
                        const rect = el.getBoundingClientRect();
                        if (rect.top > window.innerHeight - 150 || rect.bottom < 80) {
                          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }
                      }
                    }, 600);
                  }
                }
              } catch {
                // Skip parse errors
              }
            }
          }
        }
      } catch (error) {
        setRequirementStates((prev) => {
          const next = new Map(prev);
          next.set(index, {
            status: "error",
            file,
            thinking: error instanceof Error ? error.message : "Analysis failed",
          });
          return next;
        });
      }
    },
    [requirements, isDemoProfile, demoDocuments, loadedPersonaName, travelerFirstName]
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: autoUploadRemainingDocs intentionally omitted to avoid circular dependency
  );

  // Auto-upload remaining demo documents
  const autoUploadRemainingDocs = useCallback(async () => {
    console.log(`[Auto-upload] Starting auto-upload. isDemoProfile: ${isDemoProfile}, demoDocuments: ${demoDocuments.length}`);
    console.log(`[Auto-upload] Manually uploaded indices:`, Array.from(manuallyUploadedIndicesRef.current));

    if (!isDemoProfile || demoDocuments.length === 0) {
      console.log(`[Auto-upload] Skipping: isDemoProfile=${isDemoProfile}, demoDocuments.length=${demoDocuments.length}`);
      return;
    }

    // Find requirements that haven't been manually uploaded yet
    const unuploadedIndices: number[] = [];
    requirements.forEach((_req, index) => {
      // Skip if already manually uploaded
      if (!manuallyUploadedIndicesRef.current.has(index)) {
        unuploadedIndices.push(index);
      }
    });

    console.log(`[Auto-upload] Found ${unuploadedIndices.length} unuploaded requirements out of ${requirements.length} total`);
    console.log(`[Auto-upload] Unuploaded indices:`, unuploadedIndices);

    // For each unuploaded requirement, find matching demo document
    for (const index of unuploadedIndices) {
      const requirement = requirements[index];
      if (!requirement) continue;

      console.log(`[Auto-upload] Looking for match for requirement ${index}: "${requirement.name}"`);

      // Find matching demo document by name using improved fuzzy matching
      const demoDoc = findBestDocumentMatch(requirement.name, demoDocuments);

      if (demoDoc) {
        console.log(`[Auto-upload] Found match: "${demoDoc.name}" for "${requirement.name}"`);
        try {
          // Fetch the image and convert to File
          const response = await fetch(demoDoc.image);
          const blob = await response.blob();
          const ext = demoDoc.image.split(".").pop() || "png";
          const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const filename = `${demoDoc.name.toLowerCase().replace(/[\s/]+/g, "-")}.${ext}`;
          const file = new File([blob], filename, { type: mimeType });

          // Trigger upload with small stagger delay to avoid overwhelming
          const delay = 300 * unuploadedIndices.indexOf(index);
          console.log(`[Auto-upload] Uploading "${demoDoc.name}" after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
          handleFileUpload(index, file);
        } catch (err) {
          console.error(`[Auto-upload] Failed to auto-upload ${demoDoc.name}:`, err);
        }
      } else {
        console.log(`[Auto-upload] No match found for requirement: "${requirement.name}"`);
      }
    }

    console.log(`[Auto-upload] Auto-upload complete`);
  }, [requirements, requirementStates, isDemoProfile, demoDocuments, handleFileUpload]);

  // Handle drag & drop for a requirement (supports both native files and demo sidebar docs)
  const handleDrop = useCallback(
    async (index: number, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverIndex(null);

      // Read data synchronously before any async ops (React recycles synthetic events)
      const demoData = e.dataTransfer.getData("application/x-demo-doc");
      const nativeFiles = e.dataTransfer.files;

      if (demoData) {
        try {
          const doc = JSON.parse(demoData);
          const response = await fetch(doc.image);
          const blob = await response.blob();
          const ext = doc.image.split(".").pop() || "png";
          const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
          const filename = `${doc.name.toLowerCase().replace(/[\s/]+/g, "-")}.${ext}`;
          const file = new File([blob], filename, { type: mimeType });
          handleFileUpload(index, file);
        } catch (err) {
          console.error("Failed to process demo document drop:", err);
        }
        return;
      }

      // Native file drop
      const file = nativeFiles[0];
      if (file) handleFileUpload(index, file);
    },
    [handleFileUpload]
  );

  // Handle click-to-browse for a requirement
  const handleBrowse = useCallback(
    (index: number) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) handleFileUpload(index, file);
      };
      input.click();
    },
    [handleFileUpload]
  );

  if (totalRequirements === 0 && !isStreaming) {
    return null;
  }

  // Find the currently-analyzing document name for contextual greeting
  const currentlyAnalyzingDoc = useMemo(() => {
    for (const [idx, state] of requirementStates) {
      if (state.status === "analyzing") {
        return requirements[idx]?.name || null;
      }
    }
    return null;
  }, [requirementStates, requirements]);

  // Build contextual greeting text based on verification state (multi-language for demo profiles)
  const greetingText = useMemo(() => {
    if (!travelerFirstName) return null;
    const name = travelerFirstName;

    let englishMessage = "";
    if (analyzedCount === 0) {
      englishMessage = `Hello ${name}, thank you for uploading your passport. Please be patient while we read through and analyze the rest of your travel documents. We're here to help.`;
    } else if (analyzedCount > 0 && analyzedCount < totalRequirements) {
      englishMessage = currentlyAnalyzingDoc
        ? `${name}, analyzing your ${currentlyAnalyzingDoc} now — ${analyzedCount} of ${totalRequirements} documents verified so far.`
        : `${name}, verifying your documents — ${analyzedCount} of ${totalRequirements} checked.`;
    } else if (analyzedCount >= totalRequirements && totalRequirements > 0) {
      englishMessage = `${name}, all ${totalRequirements} documents have been verified. Review your results below.`;
    }

    return englishMessage || null;
  }, [travelerFirstName, analyzedCount, totalRequirements, currentlyAnalyzingDoc]);

  // Generate multi-language greetings for demo profiles
  const multiLanguageGreetings = useMemo(() => {
    if (!travelerFirstName || !isDemoProfile || !loadedPersonaName) return null;

    const name = travelerFirstName;

    // Determine message type
    let messageType: "passport" | "verifying" | "complete" = "passport";
    if (analyzedCount > 0 && analyzedCount < totalRequirements) {
      messageType = "verifying";
    } else if (analyzedCount >= totalRequirements && totalRequirements > 0) {
      messageType = "complete";
    }

    // Get translations based on persona — includes current doc name for contextual updates
    const personaGreetings = getPersonaGreetings(loadedPersonaName, name, messageType, analyzedCount, totalRequirements, currentlyAnalyzingDoc);

    return personaGreetings;
  }, [travelerFirstName, analyzedCount, totalRequirements, isDemoProfile, loadedPersonaName, currentlyAnalyzingDoc]);

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Header with Progress + Greeting — sticky so the contextual message stays visible while scrolling */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{t("Documents")}</h2>
            {totalRequirements > 0 && analyzedCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {analyzedCount}/{totalRequirements}
              </span>
            )}
          </div>
          {isTranslating && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t("Translating to")} {language}...</span>
            </div>
          )}
          {!isTranslating && isStreaming && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span>{t("Loading requirements…")}</span>
            </div>
          )}
        </div>

        {/* Progress bar — only shows once verification has started */}
        {analyzedCount > 0 && totalRequirements > 0 && (
          <div className="mt-2 w-full bg-secondary rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{
                width: `${(analyzedCount / totalRequirements) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Contextual greeting — sticky inside the header so it stays visible while scrolling */}
        {hasMounted && (multiLanguageGreetings || greetingText) && (
          <div className="mt-3">
            <CompactGreeting
              multiLanguageGreetings={multiLanguageGreetings}
              greetingText={greetingText}
              language={language}
              setLanguage={setLanguage}
              t={t}
            />
          </div>
        )}
      </div>

      {/* Requirements List */}
      <div className="space-y-3">
        {requirements.map((item, index) => {
          const externalStatus = getComplianceStatus(item.name);
          const reqState = requirementStates.get(index);
          const isExpanded = expandedItems.has(index);
          const isLast = index === requirements.length - 1;

          // Determine visual status
          const status = reqState?.status || "pending";
          const statusFromCompliance =
            reqState?.compliance?.status || externalStatus;

          // Get translated text for this requirement
          const translated = translatedRequirements.get(item.name);
          const displayName = translated?.name || item.name;
          const displayDesc = translated?.description || item.description;
          // English original reference is no longer shown — full translation only

          return (
            <div
              key={`${item.name}-${index}`}
              id={`requirement-${index}`}
              ref={isLast && isStreaming ? currentItemRef : null}
              className={`
                border rounded-lg overflow-hidden transition-all duration-200
                ${dragOverIndex === index
                  ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20 scale-[1.005]"
                  : status === "analyzing"
                    ? "border-blue-500 shadow-lg shadow-blue-500/10"
                    : status === "passed"
                      ? "border-emerald-500 bg-emerald-500/[0.03]"
                      : status === "flagged"
                        ? "border-red-500 bg-red-500/[0.04]"
                        : status === "warning"
                          ? "border-amber-500 bg-amber-500/[0.04]"
                          : item.universal
                            ? "border-blue-400/30"
                            : "border-border"
                }
                animate-in slide-in-from-bottom-4 fade-in
              `}
              style={{ animationDuration: "400ms" }}
              onMouseEnter={() => {
                // On first hover of any requirement, expand the demo sidebar
                if (isDemoProfile && !sidebarExpandTriggeredRef.current) {
                  sidebarExpandTriggeredRef.current = true;
                  requestSidebarExpand();
                }
              }}
              onDragOver={(e) => {
                if (item.uploadable && status === "pending") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverIndex === index) setDragOverIndex(null);
                }
              }}
              onDrop={(e) => {
                if (item.uploadable && status === "pending") {
                  handleDrop(index, e);
                }
              }}
            >
              {/* Main requirement row — compact checklist style */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status Icon */}
                <button
                  onClick={() => toggleItem(index)}
                  className="flex-shrink-0 hover:opacity-80 transition-opacity"
                  title={`Toggle details for ${item.name}`}
                  aria-label={`Toggle details for ${item.name}`}
                >
                  <StatusIcon status={status} complianceStatus={statusFromCompliance} />
                </button>

                {/* Requirement Info — compact: number + name + one-line desc */}
                <button
                  onClick={() => toggleItem(index)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/60 tabular-nums shrink-0">{index + 1}.</span>
                    <p className={`font-medium text-foreground text-sm truncate ${isTranslating ? "opacity-50" : ""} transition-opacity`}>
                      {displayName}
                      {item.required && (
                        <span className="ml-1 text-red-400 text-xs">*</span>
                      )}
                      {item.universal && (
                        <span className="ml-1.5 text-blue-400 text-xs">({t("universal")})</span>
                      )}
                    </p>
                  </div>
                  {/* Description — single line, only shown when not expanded and not verified */}
                  {!isExpanded && status !== "passed" && (
                    <p className={`text-xs text-muted-foreground mt-0.5 ml-5 line-clamp-1 ${isTranslating ? "opacity-50" : ""} transition-opacity`}>
                      {displayDesc
                        ?.split(/\n|;/)
                        .map(s => s.trim())
                        .filter(s => !/^(Funds?:|Apply by:|Risk:|Duration:|Cost:|Processing|Fee:)/i.test(s))
                        .join(". ")
                        .replace(/\.\s*\./g, ".")
                        .trim() || displayDesc}
                    </p>
                  )}
                </button>

                {/* Upload zone (right side) */}
                {item.uploadable && status === "pending" && (
                  <button
                    onClick={() => handleBrowse(index)}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-md
                      border border-dashed border-border hover:border-blue-400
                      text-xs text-muted-foreground hover:text-blue-400
                      transition-all hover:bg-blue-500/5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t("Upload")}</span>
                  </button>
                )}

                {/* Upload status badges */}
                {status === "uploaded" && (
                  <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{reqState?.file?.name?.replace(/\.[^.]+$/, "") || "Document"}</span>
                  </div>
                )}

                {status === "analyzing" && (
                  <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-blue-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("Analyzing...")}</span>
                  </div>
                )}

                {(status === "passed" || status === "warning" || status === "flagged") && (
                  <div className="flex-shrink-0">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        status === "passed"
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : status === "warning"
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                            : "bg-red-500/20 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {status === "passed" && t("Verified")}
                      {status === "warning" && t("Warning")}
                      {status === "flagged" && t("Issue Found")}
                    </span>
                  </div>
                )}

                {!item.uploadable && status === "pending" && (
                  <div className="flex-shrink-0 text-xs text-muted-foreground px-2 py-1">
                    {t("Info only")}
                  </div>
                )}

                {/* +/− expand toggle for processed items */}
                {(status === "passed" || status === "warning" || status === "flagged") && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleItem(index); }}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-secondary/60 transition-colors text-muted-foreground/60 hover:text-muted-foreground"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <Minus className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Expanded Details / Inline Analysis */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-3 animate-in slide-in-from-top-2 fade-in">
                  {/* Inline thinking panel — live during analysis */}
                  {reqState?.thinking && status === "analyzing" && (
                    <div className="rounded-md bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-blue-400 px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {t("Analyzing document...")}
                        </span>
                      </div>
                      <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1">
                        <DynamicAnalysisFeedback
                          thinking={reqState.thinking}
                          requirementName={item.name}
                        />
                      </div>
                    </div>
                  )}

                  {/* Persisted thinking — collapsible after analysis completes */}
                  {reqState?.thinking && status !== "analyzing" && (
                    <div className="rounded-md bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedThinking((prev) => {
                            const next = new Set(prev);
                            if (next.has(index)) {
                              next.delete(index);
                            } else {
                              next.add(index);
                            }
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span className="font-medium">{t("View AI reasoning")}</span>
                        {expandedThinking.has(index) ? (
                          <ChevronDown className="w-3 h-3 ml-auto" />
                        ) : (
                          <ChevronRight className="w-3 h-3 ml-auto" />
                        )}
                      </button>
                      {expandedThinking.has(index) && (
                        <div className="px-3 pb-3 text-[13px] text-muted-foreground leading-relaxed space-y-1 border-t border-slate-200 dark:border-slate-700 pt-2 max-h-96 overflow-y-auto">
                          <FormatThinkingInline text={reqState.thinking} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Analysis result — clean line, no background box */}
                  {reqState?.compliance && (
                    <div className="flex items-start gap-2.5 py-1">
                      {reqState.compliance.status === "met" && (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      )}
                      {reqState.compliance.status === "warning" && (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      )}
                      {reqState.compliance.status === "critical" && (
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${
                          reqState.compliance.status === "met"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : reqState.compliance.status === "warning"
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-red-700 dark:text-red-400"
                        }`}>
                          {reqState.compliance.status === "met" && t("Requirement satisfied")}
                          {reqState.compliance.status === "warning" && t("Partial / unclear")}
                          {reqState.compliance.status === "critical" && t("Issue detected")}
                        </p>
                        {reqState.compliance.detail && (
                          <div className="mt-1">
                            <p className={`text-sm text-muted-foreground leading-relaxed ${
                              !expandedDetails.has(index) ? "line-clamp-2" : ""
                            }`}>
                              {reqState.compliance.detail}
                            </p>
                            {reqState.compliance.detail.length > 150 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedDetails(prev => {
                                    const next = new Set(prev);
                                    if (next.has(index)) next.delete(index);
                                    else next.add(index);
                                    return next;
                                  });
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 hover:underline"
                              >
                                {expandedDetails.has(index) ? t("Show less") : t("Show more")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cross-document findings — compact left-border list */}
                  {reqState?.crossDocFindings && reqState.crossDocFindings.length > 0 && (
                    <div className="mt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t("Cross-document checks")}
                        </p>
                        <CrossDocSummary findings={reqState.crossDocFindings} t={t} />
                      </div>
                      <div className="space-y-px">
                        {reqState.crossDocFindings.map((f, i) => {
                          const findingKey = `${index}-${i}`;
                          const isDetailOpen = expandedFindings.has(findingKey);
                          return (
                            <div key={i}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!f.detail) return;
                                  setExpandedFindings(prev => {
                                    const next = new Set(prev);
                                    if (next.has(findingKey)) next.delete(findingKey);
                                    else next.add(findingKey);
                                    return next;
                                  });
                                }}
                                className={`w-full text-left text-[13px] py-1.5 px-3 flex items-start gap-2 border-l-2 transition-colors ${
                                  f.detail ? "hover:bg-secondary/60 cursor-pointer" : "cursor-default"
                                } ${
                                  f.severity === "critical"
                                    ? "border-l-red-600"
                                    : f.severity === "warning"
                                      ? "border-l-amber-500"
                                      : "border-l-emerald-500"
                                }`}
                              >
                                <span className={`flex-1 leading-snug ${
                                  f.severity === "critical"
                                    ? "text-red-700 dark:text-red-300 font-medium"
                                    : f.severity === "warning"
                                      ? "text-amber-700 dark:text-amber-300"
                                      : "text-foreground/70"
                                }`}>
                                  {f.finding}
                                </span>
                                {f.detail && (
                                  <ChevronDown className={`w-3 h-3 text-muted-foreground/50 flex-shrink-0 mt-0.5 transition-transform ${isDetailOpen ? "rotate-180" : ""}`} />
                                )}
                              </button>
                              {isDetailOpen && f.detail && (
                                <p className="text-xs text-muted-foreground px-3 pl-5 pb-2 leading-relaxed">
                                  {f.detail}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Source + metadata footer */}
                  {(item.source || item.uploadable) && (() => {
                    const sourceUrl = item.source ? sourceUrlMap.get(item.source) : undefined;
                    const resolvedUrl = sourceUrl
                      ? buildSourceUrlWithFragment(sourceUrl, item.name)
                      : undefined;
                    const hasIssue = status === "flagged" || status === "warning";

                    return (
                      <div className="pt-1 space-y-1.5">
                        {/* Prominent source link when there's an issue — only if we have a direct URL */}
                        {item.source && hasIssue && resolvedUrl && (
                          <a
                            href={resolvedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group"
                          >
                            <svg className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" viewBox="0 0 12 12" fill="none">
                              <path d="M4.5 2H2.5C1.95 2 1.5 2.45 1.5 3v6.5c0 .55.45 1 1 1H9c.55 0 1-.45 1-1V7.5M7 1.5h3.5m0 0V5m0-3.5L6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="underline decoration-blue-600/30 dark:decoration-blue-400/20 underline-offset-2 group-hover:decoration-blue-600/60">
                              {`${t("View requirement on")} ${item.source}`}
                            </span>
                          </a>
                        )}
                        {/* Quiet metadata row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.source && !hasIssue && (
                            <span className="text-[11px] text-muted-foreground">
                              {t("Source")}:{" "}
                              {resolvedUrl ? (
                                <a
                                  href={resolvedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 underline decoration-blue-600/20 underline-offset-2 hover:decoration-blue-600/50 dark:hover:decoration-blue-400/40 transition-colors"
                                >
                                  {item.source}
                                </a>
                              ) : (
                                <span>{item.source}</span>
                              )}
                            </span>
                          )}
                          {hasIssue && item.source && (
                            <span className="text-[11px] text-muted-foreground">{item.source}</span>
                          )}
                          <span className="text-[11px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground/70">
                            {t(`${item.confidence} confidence`)}
                          </span>
                          {item.uploadable && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground/70">
                              {t("document required")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Upload zone (expanded view — larger drop area) */}
                  {item.uploadable && status === "pending" && (
                    <div
                      className="mt-2 border-2 border-dashed border-border hover:border-blue-400 rounded-lg p-6 text-center cursor-pointer transition-colors"
                      onClick={() => handleBrowse(index)}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => handleDrop(index, e)}
                    >
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t("Drop your document here or")}{" "}
                        <span className="text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">{t("browse")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t("PNG or JPEG, max 5 MB")}</p>
                    </div>
                  )}

                  {/* Error state */}
                  {status === "error" && (
                    <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                      {t("Analysis failed. Please try uploading again.")}
                      <button
                        onClick={() => handleBrowse(index)}
                        className="ml-2 text-red-300 underline hover:text-red-200"
                      >
                        {t("Retry")}
                      </button>
                    </div>
                  )}

                  {/* External compliance (from batch analysis) */}
                  {externalStatus !== "not_checked" && compliance && !reqState?.compliance && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t("Source")}: </span>
                      <span
                        className={`font-medium ${
                          externalStatus === "met"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : externalStatus === "warning"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {externalStatus === "met" && t("Requirement satisfied")}
                        {externalStatus === "warning" && t("Partial / unclear")}
                        {externalStatus === "critical" && t("Issue detected")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator */}
        {isStreaming && (
          <div className="border border-dashed border-border rounded-lg px-4 py-6 flex items-center justify-center gap-3 text-muted-foreground animate-pulse">
            <div className="flex gap-1">
              <div
                className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-sm">{t("Loading next requirement...")}</span>
          </div>
        )}
      </div>

      {/* Bottom summary — only when verification is in progress */}
      {analyzedCount > 0 && totalRequirements > 0 && !isStreaming && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-3 pb-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {analyzedCount} {t("of")} {totalRequirements} {t("verified")}
            </span>
            {analyzedCount >= totalRequirements && (
              <span className="text-emerald-500 font-medium text-xs">
                {t("All documents verified")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Status icon component */
function StatusIcon({
  status,
  complianceStatus,
}: {
  status: RequirementStatus;
  complianceStatus: string;
}) {
  if (status === "passed" || complianceStatus === "met") {
    return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === "warning" || complianceStatus === "warning") {
    return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
  }
  if (status === "flagged" || complianceStatus === "critical") {
    return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
  }
  if (status === "analyzing") {
    return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
  }
  if (status === "error") {
    return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
  }
  return <Circle className="w-5 h-5 text-muted-foreground" />;
}

/**
 * Build a source URL with a text fragment for deep-linking.
 * Uses the Scroll to Text Fragment API (#:~:text=...) to highlight
 * the relevant section on the government source page.
 * Supported in Chrome, Edge, and other Chromium browsers.
 */
function buildSourceUrlWithFragment(baseUrl: string, requirementName: string): string {
  const stopWords = new Set(["a", "an", "the", "of", "for", "from", "or", "and", "with", "to", "in", "on", "at", "by", "is", "be"]);
  const terms = requirementName
    .toLowerCase()
    .replace(/[*()]/g, "")
    .split(/[\s/]+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 3);

  if (terms.length === 0) return baseUrl;

  const textFragment = encodeURIComponent(terms.join(" "));
  if (baseUrl.includes("#")) {
    return `${baseUrl}:~:text=${textFragment}`;
  }
  return `${baseUrl}#:~:text=${textFragment}`;
}

/**
 * Dynamic analysis feedback that shows progressive stages even before thinking excerpts arrive.
 * Eliminates perceived "dead space" by showing simulated progress.
 */
function DynamicAnalysisFeedback({ thinking, requirementName }: { thinking: string; requirementName: string }) {
  const [elapsed, setElapsed] = React.useState(0);

  // Track elapsed time since component mount
  React.useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // If we have real thinking excerpts (not just "Reading document..."), show them
  const hasRealThinking = thinking && !thinking.startsWith("Reading document");

  if (hasRealThinking) {
    return <FormatThinkingInline text={thinking.slice(-1200)} />;
  }

  // Otherwise, show progressive simulated stages based on elapsed time
  const stages = [
    { threshold: 0, message: "Reading document and extracting text..." },
    { threshold: 2000, message: `Identifying key information for ${requirementName}...` },
    { threshold: 4000, message: "Checking compliance against visa requirements..." },
    { threshold: 7000, message: "Verifying document authenticity and format..." },
    { threshold: 10000, message: "Cross-referencing with other submitted documents..." },
    { threshold: 13000, message: "Performing final validation checks..." },
  ];

  // Find current stage based on elapsed time
  const currentStage = stages
    .slice()
    .reverse()
    .find(stage => elapsed >= stage.threshold) || stages[0];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 animate-pulse">
        <div className="w-1 h-1 rounded-full bg-blue-400" />
        <span className="text-muted-foreground">{currentStage.message}</span>
      </div>
    </div>
  );
}

/** Lightweight formatter for inline thinking text — renders **bold**, lists, and line breaks */
function FormatThinkingInline({ text }: { text: string }) {
  const lines = text.split("\n");

  // Process **bold** markers within a line
  const renderBold = (line: string, lineIdx: number) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, j) =>
      j % 2 === 1
        ? <strong key={`${lineIdx}-${j}`} className="text-foreground/80 font-medium">{part}</strong>
        : <span key={`${lineIdx}-${j}`}>{part}</span>
    );
  };

  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === "") return null;

        // Numbered list items: "1. ", "2. ", etc.
        if (/^\d+\.\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground/50 flex-shrink-0 w-4 text-right">
                {trimmed.match(/^(\d+)\./)?.[1]}.
              </span>
              <span>{renderBold(trimmed.replace(/^\d+\.\s*/, ""), i)}</span>
            </div>
          );
        }

        // Bullet/dash items: "- " or "— "
        if (trimmed.startsWith("- ") || trimmed.startsWith("— ")) {
          return (
            <div key={i} className="pl-6">
              <span className="text-muted-foreground/40 mr-1.5">›</span>
              {renderBold(trimmed.replace(/^[-—]\s*/, ""), i)}
            </div>
          );
        }

        // Checkmark lines
        if (trimmed.endsWith("✓") || trimmed.endsWith("✔")) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="flex-1">{renderBold(trimmed.replace(/[✓✔]\s*$/, ""), i)}</span>
              <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0 mt-1" />
            </div>
          );
        }

        return <div key={i}>{renderBold(trimmed, i)}</div>;
      })}
    </>
  );
}

/** Cross-document findings severity summary — e.g. "3 consistent · 1 note" */
function CrossDocSummary({ findings, t }: { findings: CrossDocFinding[]; t: (s: string) => string }) {
  const counts = { info: 0, warning: 0, critical: 0 };
  findings.forEach(f => counts[f.severity]++);
  const parts: React.ReactElement[] = [];
  if (counts.info > 0) parts.push(
    <span key="info" className="text-emerald-600 dark:text-emerald-400 font-medium">{counts.info} {t("consistent")}</span>
  );
  if (counts.warning > 0) parts.push(
    <span key="warn" className="text-amber-600 dark:text-amber-400 font-medium">{counts.warning} {counts.warning === 1 ? t("note") : t("notes")}</span>
  );
  if (counts.critical > 0) parts.push(
    <span key="crit" className="text-red-600 dark:text-red-400">{counts.critical} {counts.critical === 1 ? t("issue") : t("issues")}</span>
  );
  return (
    <p className="text-xs">
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <span className="text-muted-foreground"> · </span>}{p}</span>
      ))}
    </p>
  );
}

/**
 * Compact inline language switcher — shown next to the greeting.
 * Shows current language as a pill; clicking opens a small dropdown.
 */
function InlineLanguageSwitch({
  language,
  setLanguage,
  t,
}: {
  language: string;
  setLanguage: (lang: string) => void;
  t: (s: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Top languages for compact display
  const topLanguages = LANGUAGES.slice(0, 12);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
        title={t("Change language")}
      >
        <Globe className="w-3 h-3" />
        <span className="hidden sm:inline">{language === "English" ? t("English") : language}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-popover shadow-lg py-1 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {topLanguages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setLanguage(lang.name);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-colors flex items-center justify-between ${
                language === lang.name ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <span>{lang.nativeName}</span>
              {language === lang.name && (
                <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Extract a first name from passport structuredData.
 * Handles common field names the document agent may produce.
 */
function extractFirstName(data: Record<string, unknown>): string | null {
  // Try common passport field patterns (case-insensitive key search)
  const keys = Object.keys(data);
  const find = (patterns: string[]) => {
    for (const pattern of patterns) {
      const key = keys.find(k => k.toLowerCase().replace(/[_\s-]/g, "").includes(pattern));
      if (key && typeof data[key] === "string" && (data[key] as string).trim()) {
        return (data[key] as string).trim();
      }
    }
    return null;
  };

  // Try given name / first name first
  const given = find(["givenname", "firstname", "given_name", "first_name", "prenom"]);
  if (given) {
    // Take the first word if it contains spaces (e.g., "PRIYA SHARMA" in given names field)
    return given.split(/\s+/)[0].charAt(0).toUpperCase() + given.split(/\s+/)[0].slice(1).toLowerCase();
  }

  // Try full name / holder name and take the first word
  const full = find(["holdername", "fullname", "name", "holder_name", "full_name", "applicantname"]);
  if (full) {
    const firstName = full.split(/\s+/)[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }

  // Try surname as last resort — not ideal but better than nothing
  return null;
}

/** Convert File to base64 string (without the data: prefix) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/xxx;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
