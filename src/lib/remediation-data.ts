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
  /** Pre-written compliance detail for demo fast-path (skips LLM re-verification) */
  passResult?: string;
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
      passResult:
        "Cover letter correctly identifies applicant as permanent Senior Software Engineer at TechVista Solutions Pvt. Ltd. (₹85,000/month), matching Hindi employment letter. Trip purpose (ESAS 2026 conference, Berlin), travel dates (March 10–25, 2026), and ties to India (permanent employment, family residence in Mumbai) are clearly articulated. No cross-lingual contradictions detected.",
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
      passResult:
        "Official invitation issued from info@esas-conference.org on ESAS Conference letterhead with registration REG-2026-ESAS-4782. Conference dates (March 13–15, 2026), venue (Berlin Convention Centre), and organizer details verified against public records. Sender domain resolves to legitimate conference organization. No forensic flags detected.",
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
      passResult:
        "Day-by-day itinerary accounts for all 15 days: ESAS 2026 conference (Mar 13–15), pre-conference client meetings with SAP Labs (Mar 11–12), post-conference networking and Berlin tech meetups (Mar 16–18), disclosed leisure days (Mar 19–21) with confirmed return flight BER→BOM on March 25. Trip duration is fully justified with business and tourism activities. No narrative gaps remain.",
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
      issueTitle: "Forensic Flag — Insufficient Funds Holding Period",
      issueDetail:
        "UKVI requires funds to be held for 28 consecutive days before application submission. Forensic review reveals ₦2,000,000 transfer from parents deposited on Dec 10 — only 21 days before statement end date. Timing pattern suggests funds were specifically arranged for visa application rather than demonstrating genuine financial capacity. The elevated balance was not maintained for the mandatory holding period.",
      fixDetail:
        "Extended statement period to 3 months (Nov 2025 – Jan 2026) showing stable balance of ₦44M+ held continuously for 92 days. Removed third-party transfers — all deposits now from legitimate salary credits with consistent monthly patterns exceeding UKVI financial threshold.",
      severity: "critical",
      changes: [
        { field: "Statement Period", original: "1 month (Dec 2025)", corrected: "3 months (Nov 2025 – Jan 2026)" },
        { field: "Funds Holding Period", original: "21 days (insufficient)", corrected: "92 consecutive days" },
        { field: "Forensic Red Flag", original: "₦2M from parents (Dec 10)", corrected: "None — only salary credits" },
        { field: "Closing Balance (GBP equiv.)", original: "≈ £9,181", corrected: "≈ £27,760" },
      ],
      correctedDocName: "Bank Statement (3-Month)",
      correctedDocLanguage: "English",
      passResult:
        "3-month bank statement (Nov 2025 – Jan 2026) shows consistent balance of ₦44,200,000+ maintained for 92 consecutive days, exceeding UKVI 28-day holding requirement. All deposits traceable to salary credits from University of Lagos. No third-party transfers or suspicious capital injections. GBP equivalent ≈ £27,760 exceeds Tier 4 financial threshold of £1,334/month for 9 months (£12,006).",
    },
    {
      id: "amara-ielts",
      requirementName: "IELTS Score Report",
      originalDocImage: "/demo-docs/amara-06-ielts-score.png",
      correctedDocImage: "/demo-docs/amara-06-ielts-score-corrected.png",
      issueTitle: "Documentation Gap — Test Requirement Not Met",
      issueDetail:
        "IELTS Speaking component score of 5.5 falls below UKVI mandatory minimum of 6.0 for Tier 4 student visa eligibility. Cross-referencing with Home Office policy guidance confirms all individual component scores (Reading, Writing, Listening, Speaking) must independently meet the 6.0 threshold — overall band score alone does not satisfy requirements. This represents a hard requirement failure resulting in automatic application rejection.",
      fixDetail:
        "Candidate retook IELTS examination on January 18, 2026. Updated Speaking score: 6.5 (exceeds 6.0 minimum by 0.5 points). Overall band score improved from 6.5 to 7.0. New TRF number issued: 26NG005104OKAA002A.",
      severity: "critical",
      changes: [
        { field: "Speaking Score", original: "5.5 (below 6.0 min)", corrected: "6.5 (meets requirement)" },
        { field: "Overall Band", original: "6.5", corrected: "7.0" },
        { field: "Test Date", original: "12 December 2025", corrected: "18 January 2026 (retake)" },
        { field: "TRF Number", original: "26NG004827OKAA001A", corrected: "26NG005104OKAA002A" },
      ],
      correctedDocName: "IELTS Score Report (Retake)",
      correctedDocLanguage: "English",
      passResult:
        "IELTS Academic retake (Jan 18, 2026) — TRF 26NG005104OKAA002A verified against British Council database. All component scores meet UKVI Tier 4 minimum of 6.0: Listening 7.5, Reading 7.0, Writing 6.5, Speaking 6.5. Overall Band 7.0. Test date within 2-year validity window. No component below threshold.",
    },
    {
      id: "amara-personal-statement",
      requirementName: "Personal Statement",
      originalDocImage: "/demo-docs/amara-05-personal-statement.png",
      correctedDocImage: "/demo-docs/amara-05-personal-statement-corrected.png",
      issueTitle: "Narrative Inconsistency — Weak Return Justification",
      issueDetail:
        "Personal statement lacks substantive post-graduation plans and contains no explicit mention of return intent to Nigeria. UKVI credibility assessment framework requires applicants to demonstrate genuine student status with clear intention to depart UK after course completion. Vague phrasing like \"explore various career paths\" creates narrative gaps that immigration officers interpret as potential settlement risk. Absence of specific return plans, employer commitments, or family ties weakens the overall application narrative.",
      fixDetail:
        "Reconstructed personal statement with concrete return-to-Nigeria plan: establish tech research laboratory specializing in AI for agricultural optimization. Added employer commitment letter (position held by Tech Solutions Ltd, Lagos) confirming post-study role leading Machine Learning team. Documented strong family ties (parents and three siblings in Lagos) and professional network requiring physical presence in Nigeria.",
      severity: "warning",
      changes: [
        { field: "Return Intent", original: "Not mentioned", corrected: "Explicit: return to Nigeria to establish tech research lab" },
        { field: "Employer Commitment", original: "Not mentioned", corrected: "Position held by manager; expected to lead ML team" },
        { field: "Family Ties", original: "Not mentioned", corrected: "Parents and siblings in Lagos" },
        { field: "Career Specificity", original: "\"Explore various career paths\"", corrected: "Lead AI division at Tech Solutions Ltd" },
      ],
      correctedDocName: "Personal Statement (Revised)",
      correctedDocLanguage: "English",
      passResult:
        "Personal statement articulates clear return-to-Nigeria plan: establish AI research laboratory for agricultural optimization at University of Lagos. Employer commitment from Tech Solutions Ltd (Lagos) confirms position held for post-study return as ML team lead. Strong family ties documented (parents and three siblings in Lagos). Genuine student intent established with specific career trajectory and homeland obligations. No narrative inconsistencies detected.",
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
      issueTitle: "Forensic Flag — Borrowed Funds Detected",
      issueDetail:
        "Bank statement shows R$15,000 \"Empréstimo Pessoal\" (personal loan) deposited on Jan 22 — timing aligns suspiciously with visa application date. Forensic analysis reveals base balance of only ~R$9,400 before this capital injection. Japanese consulates flag borrowed funds as they do not demonstrate genuine financial capacity for independent travel.",
      fixDetail:
        "Extended statement period to 3 months (Nov 2025 – Jan 2026) showing consistent balance of R$42,800+ sourced from legitimate photography income. Removed loan deposits — all transactions now traceable to client payments and commercial photography work.",
      severity: "critical",
      changes: [
        { field: "Statement Period", original: "2 months (Dec–Jan)", corrected: "3 months (Nov 2025 – Jan 2026)" },
        { field: "Forensic Red Flag", original: "R$15,000 personal loan (Jan 22)", corrected: "None — all deposits from photography work" },
        { field: "Minimum Sustained Balance", original: "~R$9,400", corrected: "R$42,800+ (consistent)" },
        { field: "Closing Balance", original: "R$ 24,050", corrected: "R$ 73,500" },
      ],
      correctedDocName: "Extrato Bancário (3 Meses)",
      correctedDocLanguage: "Portuguese",
      passResult:
        "3-month bank statement (Nov 2025 – Jan 2026) shows sustained balance of R$42,800+ from legitimate photography income. All deposits traceable to named client payments (Studio Lumière, Editora Abril, independent commissions). No personal loans or suspicious capital injections detected. Closing balance R$73,500 demonstrates sufficient funds for 21-day Japan trip. Forensic review: clean.",
    },
    {
      id: "carlos-freelance-income",
      requirementName: "Freelance Income Proof",
      originalDocImage: "/demo-docs/carlos-03-freelance-income.png",
      correctedDocImage: "/demo-docs/carlos-03-freelance-income-corrected.png",
      issueTitle: "Documentation Gap — Unverified Income Source",
      issueDetail:
        "Freelance income declaration listed as \"Não registrado\" (not registered) with no CNPJ/MEI registration number. Cross-referencing with Receita Federal database would reveal no official business record. Without MEI/CNPJ validation, the income declaration becomes a self-signed document with no governmental backing — Japanese consulates require verifiable income proof with official registration.",
      fixDetail:
        "Added complete MEI registration framework: CNPJ 12.345.678/0001-90, municipal inscription (CCM: SP-8.765.432-1), CNAE activity code 7420-0/01 (Professional Photography), and Prefeitura de São Paulo official stamp with current DAS-MEI payment proof.",
      severity: "critical",
      changes: [
        { field: "CNPJ/MEI Registration", original: "Não registrado", corrected: "12.345.678/0001-90" },
        { field: "Municipal Inscription", original: "None", corrected: "CCM: SP-8.765.432-1" },
        { field: "CNAE Activity Code", original: "Not listed", corrected: "7420-0/01 (Fotografia)" },
        { field: "Official Validation", original: "Self-signed only", corrected: "Prefeitura stamp + DAS-MEI current" },
      ],
      correctedDocName: "Declaração de Renda (com MEI)",
      correctedDocLanguage: "Portuguese",
      passResult:
        "Freelance income declaration includes valid MEI registration: CNPJ 12.345.678/0001-90, municipal inscription CCM SP-8.765.432-1, CNAE 7420-0/01 (Professional Photography). DAS-MEI payment current through January 2026. Prefeitura de São Paulo official stamp present. Income of R$8,500/month verified against bank statement deposits. Registration cross-references with Receita Federal database. No documentation gaps.",
    },
    {
      id: "carlos-itinerary",
      requirementName: "Travel Itinerary",
      originalDocImage: "/demo-docs/carlos-04-itinerary.png",
      correctedDocImage: "/demo-docs/carlos-04-itinerary-corrected.png",
      issueTitle: "Narrative Inconsistency — Incomplete Travel Plan",
      issueDetail:
        "21-day itinerary contains only generic city names (\"Tokyo, Kyoto, Osaka\") with no substantive daily activities or booking confirmations. States accommodations \"to be determined on arrival\" — a significant red flag for Japanese consulates who require comprehensive pre-planned itineraries. The narrative gap between stated tourist purpose and vague planning suggests incomplete trip preparation or alternative undisclosed intentions.",
      fixDetail:
        "Reconstructed complete day-by-day itinerary with specific photography locations, museum visits with admission times, all hotel confirmations with booking references (4 properties), JR Rail Pass order number (JP-2026-88412), and confirmed return flight details (LATAM LA8083, Apr 21, 18:45).",
      severity: "warning",
      changes: [
        { field: "Daily Activities", original: "\"Visit various districts\"", corrected: "Specific locations per day with times" },
        { field: "Accommodations", original: "\"To be determined on arrival\"", corrected: "4 hotels with confirmation numbers" },
        { field: "Transportation", original: "Not specified", corrected: "JR Rail Pass (Order #JP-2026-88412)" },
        { field: "Return Flight", original: "Not referenced", corrected: "LATAM LA8083, Apr 21, 18:45" },
      ],
      correctedDocName: "Japan Travel Itinerary (Detailed)",
      correctedDocLanguage: "English",
      passResult:
        "Comprehensive 21-day itinerary with specific daily activities: Tokyo photography locations (Shinjuku, Shibuya, Asakusa), Kyoto temple circuit (Fushimi Inari, Kinkaku-ji, Arashiyama), Osaka street food tour, Hiroshima day trip. All 4 hotel bookings confirmed with reservation numbers. JR Rail Pass order #JP-2026-88412 verified. Return flight LATAM LA8083 on Apr 21 at 18:45 confirmed. No gaps in accommodation or travel plan.",
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
