/**
 * Advisory Agent — Agent 3 of 3
 *
 * Synthesizes research requirements, document extractions, and compliance results
 * into a prioritized action plan with remediation steps, interview tips, and
 * corridor-specific warnings.
 *
 * Uses Claude Opus 4.6 with extended thinking for deep reasoning.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import {
  RequirementsChecklist,
  DocumentExtraction,
  ComplianceItem,
  AdvisoryReport,
  RemediationItem,
  SSEEvent,
  ApplicationAssessment,
} from "../types";
import type { ThinkingDelta, TextDelta } from "../../types/anthropic";
import { AI_CONFIG, STREAMING_CONFIG } from "../config";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function elapsed(start: number, msg: string) {
  const ms = Date.now() - start;
  const s = (ms / 1000).toFixed(1);
  console.log(`[Advisory Agent] ${msg} @ +${s}s`);
}

/**
 * Build the system prompt for the advisory agent.
 */
function buildSystemPrompt(requirements: RequirementsChecklist): string {
  return `You are a helpful visa application advisor whose mission is to empower travelers to cross borders confidently. You review applications with a kind, supportive tone — like a knowledgeable friend who wants to see them succeed.

You have been given:
1. The full requirements checklist for ${requirements.corridor}
2. Document extractions from the applicant's uploaded documents
3. Compliance check results for each requirement

VISA TYPE: ${requirements.visaType}

Your goal: Help them strengthen their application by identifying what needs fixing and explaining exactly how to fix it — in plain, friendly language.

Produce a JSON response matching this exact schema:

{
  "overall": "APPLICATION_PROCEEDS" | "ADDITIONAL_DOCUMENTS_NEEDED" | "SIGNIFICANT_ISSUES",
  "fixes": [
    {
      "priority": 1,
      "severity": "critical" | "warning" | "info",
      "issue": "Friendly, clear description of what's wrong",
      "fix": "Specific, actionable steps to fix it. Include URLs where helpful (e.g., https://incometax.gov.in for IT returns)",
      "documentRef": "optional - which document this relates to"
    }
  ],
  "interviewTips": [
    "2-4 practical tips for the interview. Be specific and helpful, not generic."
  ],
  "corridorWarnings": [
    "Important things to know about this specific travel corridor (e.g., processing delays, common pitfalls)"
  ]
}

TONE & STYLE GUIDELINES:
- Use warm, encouraging language. Say "Let's fix this" not "You must correct"
- Be specific and actionable. Instead of "Fix your bank statement", say "Contact your bank to get statements showing the last 6 months of transactions, with your name and account number visible on each page"
- Include helpful URLs when mentioning portals or websites (e.g., embassy websites, government portals)
- Avoid bureaucratic jargon. Say "valid passport" not "valid travel document as per Schengen regulations"
- Be honest but encouraging. If there's a serious issue, acknowledge it but frame the fix positively

ASSESSMENT GUIDELINES:
- "overall" should reflect reality:
  - APPLICATION_PROCEEDS: All critical requirements met, only minor improvements suggested
  - ADDITIONAL_DOCUMENTS_NEEDED: Some items missing or incorrect but easy to fix
  - SIGNIFICANT_ISSUES: Major problems (contradictions, missing critical docs, serious compliance failures)
- "fixes" ordered by priority (1 = most urgent). Each fix should:
  - Clearly state the problem
  - Give specific steps to fix it
  - Include relevant URLs or contact info where helpful
- "interviewTips": 2-4 practical tips based on the ACTUAL documents and visa type. Examples:
  - "Be ready to explain the €86,670 bank withdrawal in February — have receipts or proof of where those funds went"
  - "Practice explaining your conference attendance in German if possible — consular officers appreciate the effort"
- "corridorWarnings": Corridor-specific advice. Examples:
  - "German embassies in India have 15-day processing times during peak season (May-July) — apply early"
  - "If traveling through London, check if you need a UK transit visa"

IMPORTANT:
- Only include issues found in the actual compliance data — do NOT invent problems
- Be concise but warm. Each "issue" should be 1-2 sentences, each "fix" should be 2-3 sentences with clear steps
- Return ONLY valid JSON, no markdown fencing or explanation`;
}

/**
 * Build the user prompt with all the evidence.
 */
function buildUserPrompt(
  requirements: RequirementsChecklist,
  extractions: DocumentExtraction[],
  compliances: ComplianceItem[]
): string {
  const reqSummary = requirements.items
    .map((r) => `- ${r.name}: ${r.description}`)
    .join("\n");

  const extractionSummary = extractions
    .map(
      (e) =>
        `[${e.docType}] (${e.language}): ${e.extractedText.slice(0, 500)}${e.extractedText.length > 500 ? "..." : ""}`
    )
    .join("\n\n");

  const complianceSummary = compliances
    .map(
      (c) =>
        `- ${c.requirement}: ${c.status.toUpperCase()}${c.detail ? ` — ${c.detail}` : ""}`
    )
    .join("\n");

  return `Here is the complete application evidence for review:

## Requirements (${requirements.items.length} total)
${reqSummary}

## Uploaded Documents (${extractions.length} analyzed)
${extractionSummary}

## Compliance Results
${complianceSummary}

Please synthesize this into your advisory report.`;
}

/**
 * Run the advisory agent. Async generator that yields SSE events.
 */
export async function* runAdvisoryAgent(
  requirements: RequirementsChecklist,
  extractions: DocumentExtraction[],
  compliances: ComplianceItem[]
): AsyncGenerator<SSEEvent, AdvisoryReport | null, unknown> {
  const startTime = Date.now();

  // Signal agent start
  yield {
    type: "orchestrator",
    action: "agent_start",
    agent: "Advisory Agent",
  };

  elapsed(startTime, "Creating Anthropic stream...");

  const systemPrompt = buildSystemPrompt(requirements);
  const userPrompt = buildUserPrompt(requirements, extractions, compliances);

  try {
    const stream = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: AI_CONFIG.ADVISORY_MAX_TOKENS,
      thinking: {
        type: "adaptive",
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

    elapsed(startTime, "Anthropic stream created");

    let thinkingTokens = 0;
    let thinkingBuffer = "";
    let lastEmitTime = 0;
    let lastEmitLen = 0;
    let textContent = "";
    let thinkingDone = false;
    let textOutputStarted = false;
    let firstDelta = true;

    for await (const event of stream) {
      if (firstDelta) {
        elapsed(startTime, `First stream event received (type: ${event.type})`);
        firstDelta = false;
      }

      // Handle content block lifecycle
      if (event.type === "content_block_start") {
        const content = event.content_block;
        if (content.type === "thinking") {
          elapsed(startTime, "THINKING BLOCK START");
          thinkingDone = false;
          yield {
            type: "thinking",
            agent: "Advisory Agent",
            summary: "Reviewing application",
            excerpt: `Synthesizing ${extractions.length} documents against ${requirements.items.length} requirements...\n`,
          };
          lastEmitTime = Date.now();
          lastEmitLen = 0;
        }
        if (content.type === "text") {
          elapsed(
            startTime,
            `TEXT BLOCK START (thinking=${thinkingTokens} chars, textSoFar=${textContent.length} chars)`
          );
          if (thinkingBuffer.length > 100 || textContent.length > 100) {
            textOutputStarted = true;
            yield {
              type: "thinking",
              agent: "Advisory Agent",
              summary: "Compiling advisory",
              excerpt:
                thinkingBuffer.length > 0
                  ? thinkingBuffer.slice(-8000) +
                    "\n\n— Generating advisory report..."
                  : "Generating advisory report...",
            };
          }
        }
      }

      // Thinking block close
      if (event.type === "content_block_stop") {
        if (!thinkingDone && thinkingBuffer.length > 0) {
          thinkingDone = true;
          if (!textOutputStarted) {
            yield {
              type: "thinking",
              agent: "Advisory Agent",
              summary: "Analysis complete",
              excerpt: thinkingBuffer.slice(-8000),
            };
          }
        }
      }

      if (event.type === "content_block_delta") {
        const delta = event.delta;

        // Accumulate thinking text
        if (delta.type === "thinking_delta") {
          const thinkingDelta = delta as ThinkingDelta;
          const chunk =
            thinkingDelta.delta?.thinking || thinkingDelta.thinking || "";
          thinkingBuffer += chunk;
          thinkingTokens += chunk.length;

          // Emit thinking_depth periodically
          if (thinkingTokens > 0 && thinkingTokens % 2000 < 50) {
            yield {
              type: "thinking_depth",
              agent: "Advisory Agent",
              tokens: thinkingTokens,
              budget: AI_CONFIG.THINKING_BUDGET,
            };
          }

          // Stream thinking text
          const now = Date.now();
          const newChars = thinkingBuffer.length - lastEmitLen;
          if (
            now - lastEmitTime >= STREAMING_CONFIG.EMIT_INTERVAL_MS &&
            newChars >= STREAMING_CONFIG.MIN_NEW_CHARS
          ) {
            yield {
              type: "thinking",
              agent: "Advisory Agent",
              summary: "Reviewing application",
              excerpt: thinkingBuffer.slice(-8000),
            };
            lastEmitTime = now;
            lastEmitLen = thinkingBuffer.length;
          }
        }

        // Text accumulation
        if (delta.type === "text_delta") {
          const textDelta = delta as TextDelta;
          const text = textDelta.delta?.text || textDelta.text || "";
          textContent += text;
        }
      }
    }

    elapsed(
      startTime,
      `Stream complete (thinking=${thinkingTokens} chars, text=${textContent.length} chars)`
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
      // Try to extract partial data
      report = {
        overall: "ADDITIONAL_DOCUMENTS_NEEDED",
        fixes: [],
        interviewTips: [],
        corridorWarnings: [],
      };
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
