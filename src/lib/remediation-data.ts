// ============================================================
// Remediation Data — pre-defined fixes for each demo persona
// ============================================================

export interface RemediationChange {
  field: string;
  original: string;
  corrected: string;
}

export interface RemediationFix {
  id: string;
  requirementName: string;
  originalDocImage: string;
  correctedDocImage: string;
  issueTitle: string;
  issueDetail: string;
  fixDetail: string;
  severity: "critical" | "warning";
  changes: RemediationChange[];
  isNewDocument?: boolean;
  /** The document name that will be replaced/added in the persona's document set */
  correctedDocName: string;
  /** Language of the corrected document */
  correctedDocLanguage: string;
}

export interface PersonaRemediation {
  personaId: string;
  personaName: string;
  fixes: RemediationFix[];
}

// ============================================================
// Priya Sharma — India → Germany (Business)
// ============================================================

const priyaRemediation: PersonaRemediation = {
  personaId: "priya",
  personaName: "Priya Sharma",
  fixes: [
    {
      id: "priya-cover-letter",
      requirementName: "Cover Letter",
      originalDocImage: "/demo-docs/04-cover-letter-english.png",
      correctedDocImage: "/demo-docs/08-cover-letter-corrected.png",
      issueTitle: "Cross-Lingual Contradiction",
      issueDetail:
        "Cover letter states \"contract consultant, ₹60,000/month\" — contradicts Hindi employment letter which shows \"permanent employee, ₹85,000/month\". Consulates cross-reference these documents.",
      fixDetail:
        "Updated cover letter to match employment details from Hindi documents: permanent Senior Software Engineer at ₹85,000/month.",
      severity: "critical",
      changes: [
        { field: "Employment Status", original: "Contract Consultant", corrected: "Permanent Senior Software Engineer" },
        { field: "Monthly Salary", original: "₹60,000", corrected: "₹85,000" },
        { field: "Company Reference", original: "Vague project mention", corrected: "TechVista Solutions Pvt. Ltd." },
      ],
      correctedDocName: "Cover Letter (Corrected)",
      correctedDocLanguage: "English",
    },
    {
      id: "priya-conference-invitation",
      requirementName: "Business Invitation Letter",
      originalDocImage: "/demo-docs/05-conference-invitation-gmail.png",
      correctedDocImage: "/demo-docs/09-conference-invitation-corrected.png",
      issueTitle: "Forensic Flag — Unofficial Email Domain",
      issueDetail:
        "Conference invitation sent from easummit2026@gmail.com — a free email address. Embassy forensic checks flag this as potentially fraudulent. Legitimate conference invitations come from official organizational domains.",
      fixDetail:
        "Replaced with official invitation from info@esas-conference.org on conference letterhead with registration number.",
      severity: "critical",
      changes: [
        { field: "Sender Email", original: "easummit2026@gmail.com", corrected: "info@esas-conference.org" },
        { field: "Letterhead", original: "None (plain Gmail)", corrected: "Official ESAS Conference letterhead" },
        { field: "Registration Number", original: "Not included", corrected: "REG-2026-ESAS-4782" },
      ],
      correctedDocName: "Conference Invitation (Official)",
      correctedDocLanguage: "English",
    },
    {
      id: "priya-travel-itinerary",
      requirementName: "Travel Itinerary",
      originalDocImage: "/demo-docs/06-flight-booking.png",
      correctedDocImage: "/demo-docs/10-travel-itinerary.png",
      issueTitle: "Narrative Gap — Unexplained Trip Duration",
      issueDetail:
        "15-day trip for a 3-day conference (March 12-14) with no explanation for the remaining 12 days. Consulates may question the true purpose of travel.",
      fixDetail:
        "Added detailed day-by-day itinerary showing conference attendance, client meetings, networking events, and brief tourism.",
      severity: "warning",
      changes: [
        { field: "Itinerary Detail", original: "Flight booking only", corrected: "Full day-by-day plan" },
        { field: "Business Justification", original: "Conference only (3 days)", corrected: "Conference + client meetings + networking" },
        { field: "Tourism Disclosure", original: "Not mentioned", corrected: "3 days disclosed with return flight" },
      ],
      isNewDocument: true,
      correctedDocName: "Detailed Travel Itinerary",
      correctedDocLanguage: "English",
    },
  ],
};

// ============================================================
// Amara Okafor — Nigeria → United Kingdom (Student)
// ============================================================

const amaraRemediation: PersonaRemediation = {
  personaId: "amara",
  personaName: "Amara Okafor",
  fixes: [
    {
      id: "amara-bank-statement",
      requirementName: "Bank Statement",
      originalDocImage: "/demo-docs/amara-03-bank-statement.png",
      correctedDocImage: "/demo-docs/amara-03-bank-statement-corrected.png",
      issueTitle: "28-Day Funds Holding Requirement Not Met",
      issueDetail:
        "UKVI requires funds to be held for 28 consecutive days. Statement shows a ₦2,000,000 transfer from parents on Dec 10 — only 21 days before statement end. The higher balance was not maintained for the required period.",
      fixDetail:
        "Extended statement to 3 months (Nov 2025 – Jan 2026) showing stable balance of ₦44M+ held continuously for 92 days. No sudden large deposits from third parties.",
      severity: "critical",
      changes: [
        { field: "Statement Period", original: "1 month (Dec 2025)", corrected: "3 months (Nov 2025 – Jan 2026)" },
        { field: "Funds Holding Period", original: "21 days (insufficient)", corrected: "92 consecutive days" },
        { field: "Large Third-Party Deposits", original: "₦2M from parents (Dec 10)", corrected: "None — only salary credits" },
        { field: "Closing Balance (GBP equiv.)", original: "≈ £9,181", corrected: "≈ £27,760" },
      ],
      correctedDocName: "Bank Statement (3-Month)",
      correctedDocLanguage: "English",
    },
    {
      id: "amara-ielts",
      requirementName: "IELTS Score Report",
      originalDocImage: "/demo-docs/amara-06-ielts-score.png",
      correctedDocImage: "/demo-docs/amara-06-ielts-score-corrected.png",
      issueTitle: "Speaking Sub-Score Below UKVI Minimum",
      issueDetail:
        "IELTS Speaking score of 5.5 is below the UKVI minimum of 6.0 for Tier 4 student visas. All individual component scores must meet the minimum threshold — overall band score alone is not sufficient.",
      fixDetail:
        "Retake IELTS on January 18, 2026. New Speaking score: 6.5 (above 6.0 minimum). Overall band improved to 7.0.",
      severity: "critical",
      changes: [
        { field: "Speaking Score", original: "5.5 (below 6.0 min)", corrected: "6.5 (meets requirement)" },
        { field: "Overall Band", original: "6.5", corrected: "7.0" },
        { field: "Test Date", original: "12 December 2025", corrected: "18 January 2026 (retake)" },
        { field: "TRF Number", original: "26NG004827OKAA001A", corrected: "26NG005104OKAA002A" },
      ],
      correctedDocName: "IELTS Score Report (Retake)",
      correctedDocLanguage: "English",
    },
    {
      id: "amara-personal-statement",
      requirementName: "Personal Statement",
      originalDocImage: "/demo-docs/amara-05-personal-statement.png",
      correctedDocImage: "/demo-docs/amara-05-personal-statement-corrected.png",
      issueTitle: "Vague Career Plans — No Return Intent",
      issueDetail:
        "Personal statement lacks specific post-graduation plans and does not mention intent to return to Nigeria. UKVI officers assess whether applicants are genuine students who plan to leave the UK after studies. Vague language like \"explore various career paths\" raises concerns.",
      fixDetail:
        "Strengthened statement with specific return-to-Nigeria plan (establish tech research lab), employer commitment (position held at Tech Solutions Ltd), and family ties in Lagos.",
      severity: "warning",
      changes: [
        { field: "Return Intent", original: "Not mentioned", corrected: "Explicit: return to Nigeria to establish tech research lab" },
        { field: "Employer Commitment", original: "Not mentioned", corrected: "Position held by manager; expected to lead ML team" },
        { field: "Family Ties", original: "Not mentioned", corrected: "Parents and siblings in Lagos" },
        { field: "Career Specificity", original: "\"Explore various career paths\"", corrected: "Lead AI division at Tech Solutions Ltd" },
      ],
      correctedDocName: "Personal Statement (Revised)",
      correctedDocLanguage: "English",
    },
  ],
};

// ============================================================
// Carlos Mendes — Brazil → Japan (Tourism)
// ============================================================

const carlosRemediation: PersonaRemediation = {
  personaId: "carlos",
  personaName: "Carlos Mendes",
  fixes: [
    {
      id: "carlos-bank-statement",
      requirementName: "Bank Statement",
      originalDocImage: "/demo-docs/carlos-02-bank-statement.png",
      correctedDocImage: "/demo-docs/carlos-02-bank-statement-corrected.png",
      issueTitle: "Suspicious Deposit & Insufficient History",
      issueDetail:
        "Bank statement shows R$15,000 \"Empréstimo Pessoal\" (personal loan) deposited on Jan 22 — just days before the visa application. Base balance was only ~R$9,400 before this injection. Japanese consulates flag borrowed funds as they do not demonstrate genuine financial capacity.",
      fixDetail:
        "Extended statement to 3 months (Nov 2025 – Jan 2026) showing consistent balance of R$42,800+ from photography income. No loans or third-party transfers.",
      severity: "critical",
      changes: [
        { field: "Statement Period", original: "2 months (Dec–Jan)", corrected: "3 months (Nov 2025 – Jan 2026)" },
        { field: "Suspicious Deposits", original: "R$15,000 personal loan (Jan 22)", corrected: "None — all deposits from photography work" },
        { field: "Minimum Sustained Balance", original: "~R$9,400", corrected: "R$42,800+ (consistent)" },
        { field: "Closing Balance", original: "R$ 24,050", corrected: "R$ 73,500" },
      ],
      correctedDocName: "Extrato Bancário (3 Meses)",
      correctedDocLanguage: "Portuguese",
    },
    {
      id: "carlos-freelance-income",
      requirementName: "Freelance Income Proof",
      originalDocImage: "/demo-docs/carlos-03-freelance-income.png",
      correctedDocImage: "/demo-docs/carlos-03-freelance-income-corrected.png",
      issueTitle: "Missing Business Registration (CNPJ/MEI)",
      issueDetail:
        "Freelance income declaration has no CNPJ registration number — listed as \"Não registrado\" (not registered). Without MEI/CNPJ, the income declaration is a self-signed document with no official validation. Japanese consulates require verifiable income proof.",
      fixDetail:
        "Added proper MEI registration (CNPJ: 12.345.678/0001-90), municipal inscription (CCM), CNAE activity code, and Prefeitura de São Paulo official stamp.",
      severity: "critical",
      changes: [
        { field: "CNPJ/MEI Number", original: "Não registrado", corrected: "12.345.678/0001-90" },
        { field: "Municipal Inscription", original: "None", corrected: "CCM: SP-8.765.432-1" },
        { field: "CNAE Activity Code", original: "Not listed", corrected: "7420-0/01 (Fotografia)" },
        { field: "Official Validation", original: "Self-signed only", corrected: "Prefeitura stamp + DAS-MEI current" },
      ],
      correctedDocName: "Declaração de Renda (com MEI)",
      correctedDocLanguage: "Portuguese",
    },
    {
      id: "carlos-itinerary",
      requirementName: "Travel Itinerary",
      originalDocImage: "/demo-docs/carlos-04-itinerary.png",
      correctedDocImage: "/demo-docs/carlos-04-itinerary-corrected.png",
      issueTitle: "Vague Itinerary — No Specific Plans",
      issueDetail:
        "21-day itinerary only lists general city names (\"Tokyo, Kyoto, Osaka\") with no daily activities, specific accommodation details, or transportation arrangements. States accommodations \"to be determined on arrival\" — a red flag for Japanese consulates.",
      fixDetail:
        "Created detailed day-by-day itinerary with specific activities, all hotel confirmations with booking references, JR Rail Pass order, and return flight details.",
      severity: "warning",
      changes: [
        { field: "Daily Activities", original: "\"Visit various districts\"", corrected: "Specific locations per day with times" },
        { field: "Accommodations", original: "\"To be determined on arrival\"", corrected: "4 hotels with confirmation numbers" },
        { field: "Transportation", original: "Not specified", corrected: "JR Rail Pass (Order #JP-2026-88412)" },
        { field: "Return Flight", original: "Not referenced", corrected: "LATAM LA8083, Apr 21, 18:45" },
      ],
      correctedDocName: "Japan Travel Itinerary (Detailed)",
      correctedDocLanguage: "English",
    },
  ],
};

// ============================================================
// Export all remediations
// ============================================================

export const PERSONA_REMEDIATIONS: PersonaRemediation[] = [
  priyaRemediation,
  amaraRemediation,
  carlosRemediation,
];

/** Look up remediation data for a given persona. Returns null if not a demo persona. */
export function getRemediationForPersona(personaId: string): PersonaRemediation | null {
  return PERSONA_REMEDIATIONS.find((r) => r.personaId === personaId) || null;
}

/** Look up remediation data by persona name (e.g., "Priya Sharma"). */
export function getRemediationByName(personaName: string): PersonaRemediation | null {
  return PERSONA_REMEDIATIONS.find((r) => r.personaName === personaName) || null;
}
