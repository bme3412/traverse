import { sseResponse } from "@/lib/sse";
import {
  SSEEvent,
  RequirementsChecklist,
  DocumentExtraction,
  ComplianceItem,
} from "@/lib/types";
import { runAdvisoryAgent } from "@/lib/agents/advisory";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Advisory agent endpoint.
 * Accepts requirements, extractions, and compliances.
 * Returns SSE stream with thinking updates, recommendations, and assessment.
 */
export async function POST(request: Request) {
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

  if (!requirements) {
    return new Response(
      JSON.stringify({ error: "Missing requirements" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return sseResponse(() => advisoryFlow(requirements, extractions, compliances));
}

async function* advisoryFlow(
  requirements: RequirementsChecklist,
  extractions: DocumentExtraction[],
  compliances: ComplianceItem[]
): AsyncGenerator<SSEEvent, void, unknown> {
  const generator = runAdvisoryAgent(requirements, extractions, compliances);

  while (true) {
    const result = await generator.next();
    if (result.done) {
      break;
    }
    yield result.value;
  }
}
