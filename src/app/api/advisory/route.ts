import { sseResponse } from "@/lib/sse";
import {
  SSEEvent,
  RequirementsChecklist,
  DocumentExtraction,
  ComplianceItem,
  RemediationItem,
} from "@/lib/types";
import { runAdvisoryAgent } from "@/lib/agents/advisory";
import { checkRateLimit, createRateLimitResponse, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90; // Opus 4.6 with extended thinking for high-quality synthesis

/**
 * Advisory agent endpoint (Phase 2 — lightweight synthesis).
 * Accepts requirements, compliances, and optional preliminary fixes for refinement.
 * Returns SSE stream with recommendations and assessment.
 */
export async function POST(request: Request) {
  // Apply rate limiting (30 requests per minute for advisory synthesis)
  const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.STANDARD);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const requirements = body.requirements as RequirementsChecklist;
  const extractions = (body.extractions || []) as DocumentExtraction[];
  const compliances = (body.compliances || []) as ComplianceItem[];
  const preliminaryFixes = (body.preliminaryFixes || undefined) as RemediationItem[] | undefined;

  if (!requirements) {
    return new Response(
      JSON.stringify({ error: "Missing requirements" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return sseResponse(() => advisoryFlow(requirements, extractions, compliances, preliminaryFixes));
}

async function* advisoryFlow(
  requirements: RequirementsChecklist,
  extractions: DocumentExtraction[],
  compliances: ComplianceItem[],
  preliminaryFixes?: RemediationItem[]
): AsyncGenerator<SSEEvent, void, unknown> {
  const generator = runAdvisoryAgent(requirements, extractions, compliances, preliminaryFixes);

  while (true) {
    const result = await generator.next();
    if (result.done) {
      break;
    }
    yield result.value;
  }
}
