/**
 * Programmatic advisory builder — Phase 1 (instant) + Phase 1b (progressive updates).
 *
 * Builds an AdvisoryReport from structured requirements data without any LLM call,
 * then incrementally updates it as per-document compliance results arrive.
 */

import type {
  RequirementsChecklist,
  ComplianceItem,
  AdvisoryReport,
  RemediationItem,
  ApplicationAssessment,
  Severity,
} from "./types";

/**
 * Phase 1: Build a preliminary advisory immediately from requirements alone.
 * No LLM call — purely data-driven from the structured RequirementsChecklist.
 */
export function buildPreliminaryAdvisory(
  requirements: RequirementsChecklist
): AdvisoryReport {
  // Build a fix item for each required requirement (documents not yet uploaded)
  const fixes: RemediationItem[] = requirements.items
    .filter((item) => item.required)
    .map((item, i) => ({
      priority: i + 1,
      severity: "info" as Severity,
      issue: `${item.name} — required for your ${requirements.visaType} application`,
      fix: item.personalizedDetail || item.description,
      documentRef: item.uploadable ? item.name : undefined,
    }));

  // Corridor warnings from importantNotes + enriched metadata
  const corridorWarnings: string[] = [
    ...requirements.importantNotes,
  ];

  if (requirements.processingTime) {
    corridorWarnings.push(
      `Processing time: ${requirements.processingTime}. Apply at: ${requirements.applyAt}`
    );
  }

  if (requirements.applicationWindow) {
    corridorWarnings.push(
      `Application window: earliest ${requirements.applicationWindow.earliest}, latest ${requirements.applicationWindow.latest}`
    );
  }

  if (requirements.commonRejectionReasons?.length) {
    corridorWarnings.push(
      `Common rejection reasons: ${requirements.commonRejectionReasons.join("; ")}`
    );
  }

  if (requirements.financialThresholds) {
    const ft = requirements.financialThresholds;
    const parts: string[] = [];
    if (ft.dailyMinimum) parts.push(`${ft.dailyMinimum}/day minimum`);
    if (ft.totalRecommended) parts.push(`${ft.totalRecommended} total recommended`);
    if (ft.notes) parts.push(ft.notes);
    if (parts.length > 0) {
      corridorWarnings.push(`Financial requirements: ${parts.join(", ")}`);
    }
  }

  if (requirements.postArrivalRegistration?.required) {
    const reg = requirements.postArrivalRegistration;
    corridorWarnings.push(
      `Post-arrival registration required${reg.deadline ? ` ${reg.deadline}` : ""}${reg.where ? ` at ${reg.where}` : ""}`
    );
  }

  if (requirements.transitVisaInfo) {
    corridorWarnings.push(requirements.transitVisaInfo.warning);
  }

  // Template interview tips based on visa type + corridor
  const interviewTips = buildTemplateTips(requirements);

  return {
    overall: "ADDITIONAL_DOCUMENTS_NEEDED" as ApplicationAssessment,
    fixes,
    interviewTips,
    corridorWarnings,
  };
}

/**
 * Phase 1b: Update the advisory when a single document's compliance result arrives.
 * Returns a new AdvisoryReport (immutable update).
 */
export function updateAdvisoryWithCompliance(
  advisory: AdvisoryReport,
  compliance: ComplianceItem
): AdvisoryReport {
  const updatedFixes = advisory.fixes.map((fix) => {
    // Match fix to compliance by requirement name (case-insensitive partial match)
    const fixReqName = fix.documentRef || fix.issue.split("—")[0].trim();
    const matches =
      fixReqName.toLowerCase().includes(compliance.requirement.toLowerCase()) ||
      compliance.requirement.toLowerCase().includes(fixReqName.toLowerCase());

    if (!matches) return fix;

    // Update severity and description based on compliance status
    switch (compliance.status) {
      case "met":
        return {
          ...fix,
          severity: "info" as Severity,
          issue: `${compliance.requirement} — verified`,
          fix: compliance.detail || fix.fix,
          documentRef: compliance.documentRef || fix.documentRef,
        };
      case "warning":
        return {
          ...fix,
          severity: "warning" as Severity,
          issue: `${compliance.requirement} — needs attention`,
          fix: compliance.detail || fix.fix,
          documentRef: compliance.documentRef || fix.documentRef,
        };
      case "critical":
        return {
          ...fix,
          severity: "critical" as Severity,
          issue: `${compliance.requirement} — action required`,
          fix: compliance.detail || fix.fix,
          documentRef: compliance.documentRef || fix.documentRef,
        };
      default:
        return fix;
    }
  });

  // Re-sort: critical first, then warning, then info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  updatedFixes.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  // Re-number priorities
  updatedFixes.forEach((fix, i) => {
    fix.priority = i + 1;
  });

  // Compute overall assessment from compliance statuses
  const overall = computeOverallAssessment(updatedFixes);

  return {
    ...advisory,
    fixes: updatedFixes,
    overall,
  };
}

/**
 * Derive overall assessment from the current set of fixes.
 */
function computeOverallAssessment(
  fixes: RemediationItem[]
): ApplicationAssessment {
  const hasCritical = fixes.some((f) => f.severity === "critical");
  const hasWarning = fixes.some((f) => f.severity === "warning");
  const allVerified = fixes.every(
    (f) => f.severity === "info" && f.issue.includes("verified")
  );

  if (hasCritical) return "SIGNIFICANT_ISSUES";
  if (hasWarning || !allVerified) return "ADDITIONAL_DOCUMENTS_NEEDED";
  return "APPLICATION_PROCEEDS";
}

/**
 * Generate template-based interview tips from requirements metadata.
 */
function buildTemplateTips(requirements: RequirementsChecklist): string[] {
  const tips: string[] = [];
  const corridor = requirements.corridor;
  const visaType = requirements.visaType;

  tips.push(
    `Be prepared to clearly explain the purpose of your trip and how it relates to your ${visaType} application.`
  );

  if (requirements.financialThresholds) {
    tips.push(
      `Have your financial documents organized — be ready to explain the source of funds shown in your bank statements.`
    );
  }

  // Duration-specific tip
  const hasAccommodation = requirements.items.some(
    (r) => r.name.toLowerCase().includes("accommodation") || r.name.toLowerCase().includes("hotel")
  );
  if (hasAccommodation) {
    tips.push(
      `Bring a printed copy of your accommodation booking that matches your stated travel dates.`
    );
  }

  // Employment/business specific
  const hasBusiness = requirements.items.some(
    (r) =>
      r.name.toLowerCase().includes("employer") ||
      r.name.toLowerCase().includes("invitation") ||
      r.name.toLowerCase().includes("business")
  );
  if (hasBusiness) {
    tips.push(
      `If asked about your employer, have your company's registration details and your employment contract handy.`
    );
  }

  // Keep to 2-4 tips max
  return tips.slice(0, 4);
}
