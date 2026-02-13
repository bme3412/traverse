// ============================================================
// SSE Event Types — the communication protocol between
// server (agents) and client (UI)
// ============================================================

export type SSEEvent =
  | { type: "orchestrator"; action: "planning" | "agent_start" | "agent_complete"; agent?: string; message?: string; duration_ms?: number }
  | { type: "search_status"; source: string; status: "searching" | "found" | "not_found"; url?: string }
  | { type: "requirement"; item: string; detail?: string; depth: number; source?: string; uploadable?: boolean; universal?: boolean }
  | { type: "sources"; sources: SourceReference[] }
  | { type: "thinking"; agent: string; summary: string; excerpt?: string }
  | { type: "thinking_depth"; agent: string; tokens: number; budget: number }
  | { type: "document_read"; doc: string; language: string; docType?: string; duration_ms?: number }
  | { type: "cross_lingual"; finding: string; severity: Severity; details?: string }
  | { type: "forensic"; finding: string; severity: Severity; details?: string }
  | { type: "narrative"; assessment: NarrativeStrength; issues: number; details?: string }
  | { type: "recommendation"; priority: Severity; action: string; details?: string }
  | { type: "assessment"; overall: ApplicationAssessment }
  | { type: "doc_analysis_start"; requirementName: string; docFilename: string }
  | { type: "doc_analysis_result"; requirementName: string; extraction: DocumentExtraction; compliance: ComplianceItem; crossDocFindings?: CrossDocFinding[] }
  | { type: "doc_analysis_thinking"; requirementName: string; excerpt: string }
  | { type: "error"; message: string }
  | { type: "complete"; data: AnalysisResult };

export interface CrossDocFinding {
  severity: Severity;
  finding: string;
  detail: string;
}

export type Severity = "critical" | "warning" | "info";
export type NarrativeStrength = "WEAK" | "MODERATE" | "STRONG";
export type ApplicationAssessment = "APPLICATION_PROCEEDS" | "ADDITIONAL_DOCUMENTS_NEEDED" | "SIGNIFICANT_ISSUES";
export type AgentStatus = "pending" | "active" | "cached" | "complete" | "error";

// ============================================================
// Input Types
// ============================================================

export interface TravelDetails {
  passports: string[];          // Country codes (ISO 3166-1 alpha-2)
  destination: string;          // Country code
  purpose: TravelPurpose;
  dates: {
    depart: string;             // ISO date string
    return: string;             // ISO date string
  };
  travelers: number;
  event?: string;               // Optional specific event name
}

export type TravelPurpose =
  | "tourism"
  | "business"
  | "work"
  | "study"
  | "medical"
  | "transit"
  | "family"
  | "digital_nomad";

export interface UploadedDocument {
  id: string;
  filename: string;
  base64: string;               // Base64-encoded image data
  mimeType: "image/png" | "image/jpeg";
  sizeBytes: number;
}

// ============================================================
// Agent Output Types
// ============================================================

// Research Agent output
export interface RequirementsChecklist {
  corridor: string;             // e.g., "India → Germany"
  visaType: string;             // e.g., "Schengen Business Visa"
  visaRequired: boolean;
  items: RequirementItem[];
  fees: {
    visa: string;
    service?: string;
  };
  processingTime: string;
  applyAt: string;
  importantNotes: string[];
  sources?: SourceReference[];

  // ── Enriched corridor metadata (all optional) ──
  applicationWindow?: {
    earliest: string;           // e.g., "6 months before travel"
    latest: string;             // e.g., "15 working days before travel"
  };
  commonRejectionReasons?: string[];
  healthRequirements?: HealthRequirement[];
  financialThresholds?: {
    dailyMinimum?: string;      // e.g., "€45/day"
    totalRecommended?: string;  // e.g., "€675"
    currency?: string;          // e.g., "EUR"
    notes?: string;             // e.g., "Held for 28 consecutive days"
  };
  alternativeVisaTypes?: AlternativeVisa[];
  postArrivalRegistration?: {
    required: boolean;
    deadline?: string;          // e.g., "within 7 days"
    where?: string;             // e.g., "local registration office (Einwohnermeldeamt)"
  };
  documentLanguage?: {
    accepted: string[];         // e.g., ["English", "German"]
    translationRequired?: boolean;
    certifiedTranslation?: boolean;
  };
  transitVisaInfo?: {
    warning: string;            // e.g., "UK transit visa required if connecting through London"
    applies?: string;           // e.g., "Nigerian passport holders"
  };
}

export interface HealthRequirement {
  type: string;                 // e.g., "TB test", "Yellow fever vaccination"
  required: boolean;
  note?: string;                // e.g., "Required for Nigerian nationals"
}

export interface AlternativeVisa {
  type: string;                 // e.g., "e-Visa"
  processingTime?: string;      // e.g., "48 hours"
  note?: string;                // e.g., "Available for tourism only"
}

export interface RequirementItem {
  name: string;
  description: string;
  required: boolean;
  source?: string;
  confidence: "high" | "medium" | "low";
  personalizedDetail?: string;  // e.g., "Passport must be valid until Sep 25, 2026"
  uploadable?: boolean;         // true if user needs to upload a document for this requirement
  universal?: boolean;          // true for pre-emitted universal requirements (e.g., passport)
}

export interface SourceReference {
  name: string;
  url: string;
  dateAccessed?: string;
}

// Document Agent output — Pass 1
export interface DocumentExtraction {
  id: string;
  docType: string;              // e.g., "passport", "bank_statement", "employment_letter"
  language: string;             // e.g., "English", "Hindi"
  extractedText: string;
  structuredData: Record<string, unknown>;
}

// Document Agent output — Pass 2
export interface DocumentAnalysis {
  compliance: ComplianceResult;
  crossLingualFindings: CrossLingualFinding[];
  narrativeAssessment: NarrativeAssessment;
  forensicFlags: ForensicFlag[];
}

export interface ComplianceResult {
  met: number;
  warnings: number;
  critical: number;
  items: ComplianceItem[];
}

export interface ComplianceItem {
  requirement: string;
  status: "met" | "warning" | "critical" | "not_checked";
  detail?: string;
  documentRef?: string;
}

export interface CrossLingualFinding {
  severity: Severity;
  finding: string;
  doc1: { id: string; language: string; text: string };
  doc2: { id: string; language: string; text: string };
  reasoning: string;
}

export interface NarrativeAssessment {
  strength: NarrativeStrength;
  issues: NarrativeIssue[];
  summary: string;
}

export interface NarrativeIssue {
  category: string;
  description: string;
  severity: Severity;
}

export interface ForensicFlag {
  severity: Severity;
  finding: string;
  detail: string;
  documentRef?: string;
}

// Advisory Agent output
export interface AdvisoryReport {
  overall: ApplicationAssessment;
  fixes: RemediationItem[];
  interviewTips?: string[];
  corridorWarnings?: string[];
}

export interface RemediationItem {
  priority: number;
  severity: Severity;
  issue: string;
  fix: string;
  documentRef?: string;
}

// ============================================================
// Combined Analysis Result
// ============================================================

export interface AnalysisResult {
  requirements?: RequirementsChecklist;
  extractions?: DocumentExtraction[];
  analysis?: DocumentAnalysis;
  advisory?: AdvisoryReport;
}

// ============================================================
// Translation Types
// ============================================================

export interface TranslatedRequirement {
  name: string;
  description: string;
}

export interface TranslationResponse {
  items: TranslatedRequirement[];
  corridorInfo?: {
    corridor: string;
    visaType: string;
  };
  importantNotes?: string[];
}

// ============================================================
// App State
// ============================================================

export interface AppState {
  // Phase
  currentPhase: AppPhase;

  // Section 1
  travelDetails: TravelDetails | null;

  // Section 2
  requirements: RequirementsChecklist | null;
  requirementsCached: boolean;

  // Section 3
  documents: UploadedDocument[];
  extractions: DocumentExtraction[];
  analysis: DocumentAnalysis | null;
  advisory: AdvisoryReport | null;

  // Section 4 (re-audit)
  correctedDocuments: UploadedDocument[];

  // UI state
  events: SSEEvent[];
  agentStatuses: Record<string, AgentStatus>;
  error: string | null;
}

export type AppPhase =
  | "input"
  | "researching"
  | "requirements_ready"
  | "uploading"
  | "reading_documents"
  | "analyzing_documents"
  | "advising"
  | "results"
  | "reanalyzing";
