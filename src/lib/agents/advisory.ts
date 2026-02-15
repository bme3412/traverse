/**
 * Advisory Agent — Agent 3 of 3 (Phase 2: Advisory Synthesis)
 *
 * Refines a programmatically-built preliminary advisory with personalized
 * interview tips, warmer fix descriptions, and corridor-specific warnings
 * based on actual compliance results.
 *
 * Uses Claude Opus 4.6 with extended thinking to synthesize complex compliance
 * data into warm, actionable guidance with corridor-specific insights.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  RequirementsChecklist,
  DocumentExtraction,
  ComplianceItem,
  AdvisoryReport,
  RemediationItem,
  SSEEvent,
  ApplicationAssessment,
} from "../types";
import { AI_CONFIG } from "../config";
import { getEnv, isDevelopment } from "../env";

const anthropic = new Anthropic({
  apiKey: getEnv().ANTHROPIC_API_KEY,
});

function elapsed(start: number, msg: string) {
  if (isDevelopment()) {
    const ms = Date.now() - start;
    const s = (ms / 1000).toFixed(1);
    console.log(`[Advisory Agent] ${msg} @ +${s}s`);
  }
}

/**
 * Build the system prompt — shorter and more focused than before.
 */
function buildSystemPrompt(requirements: RequirementsChecklist): string {
  return `You are a friendly visa application advisor for ${requirements.corridor} (${requirements.visaType}).

You are refining a preliminary advisory that was already built from compliance results. Your job is to:
1. Rewrite each fix description to be warm, specific, and actionable (like a helpful friend)
2. Generate 2-4 personalized interview tips based on the ACTUAL compliance findings
3. Add corridor-specific warnings based on the compliance results

TONE: Warm, encouraging. Say "Let's fix this" not "You must correct". Include helpful URLs where relevant.

Produce a JSON response matching this schema:
{
  "overall": "APPLICATION_PROCEEDS" | "ADDITIONAL_DOCUMENTS_NEEDED" | "SIGNIFICANT_ISSUES",
  "fixes": [
    {
      "priority": 1,
      "severity": "critical" | "warning" | "info",
      "issue": "Friendly description of the problem",
      "fix": "Specific, actionable steps (2-3 sentences, include URLs if helpful)",
      "documentRef": "the document type from compliance data matching the [doc: ...] tag, e.g. passport, bank_statement, employment_letter — REQUIRED when the fix relates to a specific document"
    }
  ],
  "interviewTips": ["2-4 specific tips based on ACTUAL documents and findings"],
  "corridorWarnings": ["Corridor-specific advice based on compliance results"]
}

IMPORTANT:
- Only include issues from the actual compliance data — do NOT invent problems
- Be concise. Each "fix" should be 2-3 sentences max
- ALWAYS set "documentRef" to the exact [doc: ...] value from the compliance data for each fix that relates to a document (e.g. "passport", "invitation_letter", "bank_statement")
- Return ONLY valid JSON, no markdown fencing`;
}

/**
 * Build the user prompt — compliance-only, no raw extraction text.
 * Includes preliminary fixes for refinement context.
 */
function buildUserPrompt(
  requirements: RequirementsChecklist,
  compliances: ComplianceItem[],
  preliminaryFixes?: RemediationItem[]
): string {
  const reqSummary = requirements.items
    .map((r) => `- ${r.name}: ${r.description}${r.personalizedDetail ? ` (${r.personalizedDetail})` : ""}`)
    .join("\n");

  const complianceSummary = compliances
    .map(
      (c) =>
        `- ${c.requirement}: ${c.status.toUpperCase()}${c.detail ? ` — ${c.detail}` : ""}${c.documentRef ? ` [doc: ${c.documentRef}]` : ""}`
    )
    .join("\n");

  let prompt = `## Requirements (${requirements.items.length} total)
${reqSummary}

## Compliance Results (${compliances.length} checked)
${complianceSummary}`;

  if (preliminaryFixes && preliminaryFixes.length > 0) {
    const fixesSummary = preliminaryFixes
      .filter((f) => f.severity !== "info" || !f.issue.includes("verified"))
      .map(
        (f) => `- [${f.severity.toUpperCase()}] ${f.issue}: ${f.fix}`
      )
      .join("\n");

    prompt += `

## Preliminary Fixes (refine these with warmer language and specific advice)
${fixesSummary}`;
  }

  prompt += `

Please synthesize this into your advisory report. Focus on making fixes actionable and generating personalized interview tips.`;

  return prompt;
}

/**
 * Run the advisory agent (Phase 2 — lightweight synthesis).
 * Async generator that yields SSE events.
 */
export async function* runAdvisoryAgent(
  requirements: RequirementsChecklist,
  extractions: DocumentExtraction[],
  compliances: ComplianceItem[],
  preliminaryFixes?: RemediationItem[]
): AsyncGenerator<SSEEvent, AdvisoryReport | null, unknown> {
  const startTime = Date.now();

  // Signal agent start
  yield {
    type: "orchestrator",
    action: "agent_start",
    agent: "Advisory Agent",
  };

  elapsed(startTime, `Creating Opus 4.6 stream with extended thinking (${compliances.length} compliances, ${preliminaryFixes?.length || 0} preliminary fixes)...`);

  const systemPrompt = buildSystemPrompt(requirements);
  const userPrompt = buildUserPrompt(requirements, compliances, preliminaryFixes);

  try {
    const stream = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: AI_CONFIG.ADVISORY_MAX_TOKENS,
      thinking: {
        type: "enabled",
        budget_tokens: AI_CONFIG.THINKING_BUDGET,
      },
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      stream: true,
    });

    elapsed(startTime, "Opus 4.6 stream created");

    let textContent = "";
    let firstDelta = true;

    for await (const event of stream) {
      if (firstDelta) {
        elapsed(startTime, `First stream event received (type: ${event.type})`);
        firstDelta = false;
      }

      if (event.type === "content_block_delta") {
        const delta = event.delta;

        // Opus 4.6 with extended thinking - accumulate text output only
        // (thinking happens internally but we only need the final structured JSON)
        if (delta.type === "text_delta") {
          const text = (delta as { type: "text_delta"; text: string }).text || "";
          textContent += text;
        }
        // Thinking deltas are processed internally by Opus but not streamed to UI
      }
    }

    elapsed(
      startTime,
      `Stream complete (text=${textContent.length} chars)`
    );

    // Parse the advisory report from the text output
    let report: AdvisoryReport | null = null;
    try {
      // Strip markdown fencing if present
      let jsonText = textContent.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "");
      }
      const parsed = JSON.parse(jsonText);
      report = {
        overall: parsed.overall as ApplicationAssessment,
        fixes: (parsed.fixes || []) as RemediationItem[],
        interviewTips: parsed.interviewTips,
        corridorWarnings: parsed.corridorWarnings,
      };
    } catch (e) {
      elapsed(startTime, `Failed to parse advisory JSON: ${e}`);
      // Fall back to the preliminary fixes if available
      report = {
        overall: "ADDITIONAL_DOCUMENTS_NEEDED",
        fixes: preliminaryFixes || [],
        interviewTips: [],
        corridorWarnings: [],
      };
    }

    // Backfill documentRef from compliance data when the LLM omitted it.
    // Uses word-overlap scoring for robust matching (LLM rewrites issue text freely).
    if (report.fixes && compliances.length > 0) {
      const stopWords = new Set(["the", "a", "an", "is", "are", "was", "for", "of", "to", "in", "on", "and", "or", "your", "you", "it", "its", "this", "that", "with", "not", "but", "have", "has", "be", "been", "can", "will", "need", "may", "should", "must", "also", "just", "get", "make", "let"]);
      const tokenize = (text: string): Set<string> => {
        const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
        return new Set(words);
      };

      // Track which compliances are already matched to avoid duplicates
      const usedCompliances = new Set<number>();

      report.fixes = report.fixes.map((fix) => {
        if (fix.documentRef) return fix;

        const issueTokens = tokenize((fix.issue || "") + " " + (fix.fix || ""));
        let bestMatch: ComplianceItem | null = null;
        let bestScore = 0;
        let bestIdx = -1;

        for (let i = 0; i < compliances.length; i++) {
          const c = compliances[i];
          if (!c.documentRef || usedCompliances.has(i)) continue;
          // Build tokens from requirement name, detail, and docType
          const compTokens = tokenize((c.requirement || "") + " " + (c.detail || "") + " " + (c.documentRef || "").replace(/_/g, " "));
          // Count overlapping words
          let overlap = 0;
          for (const word of issueTokens) {
            if (compTokens.has(word)) overlap++;
          }
          // Normalize by the smaller set size to handle different text lengths
          const score = overlap / Math.max(1, Math.min(issueTokens.size, compTokens.size));
          if (score > bestScore && overlap >= 1) {
            bestScore = score;
            bestMatch = c;
            bestIdx = i;
          }
        }

        if (bestMatch?.documentRef) {
          if (bestIdx >= 0) usedCompliances.add(bestIdx);
          elapsed(0, `[Backfill] Fix "${fix.issue?.slice(0, 50)}" → documentRef="${bestMatch.documentRef}" (score=${bestScore.toFixed(2)})`);
          return { ...fix, documentRef: bestMatch.documentRef };
        }
        elapsed(0, `[Backfill] Fix "${fix.issue?.slice(0, 50)}" → NO MATCH (tokens: ${Array.from(issueTokens).join(",")})`);
        return fix;
      });
    }

    // Emit recommendation events for each fix
    if (report.fixes) {
      for (const fix of report.fixes) {
        yield {
          type: "recommendation",
          priority: fix.severity,
          action: fix.fix,
          details: fix.issue,
        };
      }
    }

    // Emit interview tips and corridor warnings
    if ((report.interviewTips && report.interviewTips.length > 0) ||
        (report.corridorWarnings && report.corridorWarnings.length > 0)) {
      yield {
        type: "advisory_tips",
        interviewTips: report.interviewTips || [],
        corridorWarnings: report.corridorWarnings || [],
      };
    }

    // Emit overall assessment
    yield {
      type: "assessment",
      overall: report.overall,
    };

    // Signal agent complete
    const duration = Date.now() - startTime;
    yield {
      type: "orchestrator",
      action: "agent_complete",
      agent: "Advisory Agent",
      duration_ms: duration,
    };

    elapsed(startTime, "Advisory complete");
    return report;
  } catch (error) {
    elapsed(startTime, `Error: ${error}`);

    yield {
      type: "error",
      message: `Advisory agent error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };

    yield {
      type: "orchestrator",
      action: "agent_complete",
      agent: "Advisory Agent",
      duration_ms: Date.now() - startTime,
    };

    return null;
  }
}
