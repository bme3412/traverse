import { sseResponse } from "@/lib/sse";
import { SSEEvent, TravelDetails, UploadedDocument, AnalysisResult } from "@/lib/types";
import { runResearchAgent } from "@/lib/agents/research";
import { runDocumentReaderPass1, runDocumentAnalyzerPass2 } from "@/lib/agents/document";
import { AnalyzeRequestSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120; // Allow up to 2 minutes for full pipeline

export async function POST(request: Request) {
  // Parse the request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // For now: test mode that emits sample events to verify the SSE pipeline
  // This will be replaced by the orchestrator in Layer 6
  const isTest = body.test === true;

  if (isTest) {
    return sseResponse(testGenerator);
  }

  // Validate request body using Zod
  try {
    const validated = AnalyzeRequestSchema.parse(body);
    return sseResponse(() => simpleOrchestrator(
      validated.travelDetails as TravelDetails,
      validated.documents as UploadedDocument[] | undefined
    ));
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errorMessages }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Unknown error
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Drains an async generator, yielding all events and returning the final value.
 */
async function drainGenerator<T>(
  gen: AsyncGenerator<SSEEvent, T, unknown>,
  sink: (event: SSEEvent) => void
): Promise<T> {
  while (true) {
    const result = await gen.next();
    if (result.done) return result.value;
    sink(result.value);
  }
}

/**
 * Orchestrator for Layers 2-4.
 * Runs Research Agent in parallel with Doc Pass 1 when documents are provided,
 * then runs Doc Pass 2 once both complete.
 */
async function* simpleOrchestrator(
  travelDetails: TravelDetails,
  documents?: UploadedDocument[]
): AsyncGenerator<SSEEvent, void, unknown> {
  const hasDocuments = documents && documents.length > 0;
  const agentCount = hasDocuments ? 2 : 1;

  yield {
    type: "orchestrator",
    action: "planning",
    message: `Starting analysis with ${agentCount} agent${agentCount > 1 ? 's' : ''}`,
  };

  if (!hasDocuments) {
    // --- No documents: just run Research Agent sequentially ---
    const orchStart = Date.now();
    console.log(`[Orchestrator] Starting research-only flow`);
    const researchGenerator = runResearchAgent(travelDetails);
    let requirements;
    let eventCount = 0;

    while (true) {
      const result = await researchGenerator.next();
      if (result.done) {
        requirements = result.value;
        break;
      }
      eventCount++;
      if (eventCount <= 5 || eventCount % 10 === 0) {
        console.log(`[Orchestrator] Event #${eventCount}: ${result.value.type} @ +${((Date.now() - orchStart) / 1000).toFixed(1)}s`);
      }
      yield result.value;
    }

    console.log(`[Orchestrator] Research done, ${eventCount} events total @ +${((Date.now() - orchStart) / 1000).toFixed(1)}s`);
    console.log(`[Orchestrator] Yielding complete event`);

    yield {
      type: "complete",
      data: { requirements } as AnalysisResult,
    };
    console.log(`[Orchestrator] Complete @ +${((Date.now() - orchStart) / 1000).toFixed(1)}s`);
    return;
  }

  // --- Documents provided: parallelize Research + Doc Pass 1 ---
  // Both generators run concurrently. Events are queued and yielded
  // as they arrive from either generator.

  const eventQueue: SSEEvent[] = [];
  const researchGen = runResearchAgent(travelDetails);
  const readerGen = runDocumentReaderPass1(documents);

  const sink = (event: SSEEvent) => eventQueue.push(event);

  // Start both drains concurrently
  const researchPromise = drainGenerator(researchGen, sink);
  const readerPromise = drainGenerator(readerGen, sink);

  // Yield events as they accumulate while both generators run
  const bothDone = Promise.all([researchPromise, readerPromise]);
  let settled = false;
  bothDone.then(() => { settled = true; });

  // Poll the event queue until both generators finish
  while (!settled) {
    // Wait a small tick to let events accumulate
    await new Promise(resolve => setTimeout(resolve, 50));

    // Flush queued events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }
  }

  // Flush any remaining events
  while (eventQueue.length > 0) {
    yield eventQueue.shift()!;
  }

  const [requirements, extractions] = await bothDone;

  // --- Pass 2: Analyze documents (needs both results) ---
  const analyzerGenerator = runDocumentAnalyzerPass2(extractions, requirements);
  let analysis;

  while (true) {
    const result = await analyzerGenerator.next();
    if (result.done) {
      analysis = result.value;
      break;
    }
    yield result.value;
  }

  // Complete
  const analysisResult: AnalysisResult = {
    requirements,
    extractions,
    analysis,
  };

  yield {
    type: "complete",
    data: analysisResult,
  };
}

/**
 * Test generator that emits sample events to verify the SSE pipeline end-to-end.
 */
async function* testGenerator(): AsyncGenerator<SSEEvent, void, unknown> {
  // Orchestrator planning
  yield { type: "orchestrator", action: "planning", message: "3 agents planned for this analysis" };
  await delay(500);

  // Research Agent
  yield { type: "orchestrator", action: "agent_start", agent: "research" };
  await delay(300);

  yield { type: "search_status", source: "auswaertiges-amt.de", status: "searching" };
  await delay(800);
  yield { type: "search_status", source: "auswaertiges-amt.de", status: "found" };
  await delay(200);

  yield { type: "search_status", source: "vfs-global.com", status: "searching" };
  await delay(600);
  yield { type: "search_status", source: "vfs-global.com", status: "found" };
  await delay(200);

  yield { type: "requirement", item: "Passport validity: 6+ months beyond return date", depth: 1 };
  await delay(300);
  yield { type: "requirement", item: "2 biometric photos (35x45mm, white background)", depth: 1 };
  await delay(300);
  yield { type: "requirement", item: "Bank statements (6 months)", depth: 1 };
  await delay(200);

  // Deep thinking on financial proof
  yield { type: "thinking_depth", agent: "research", tokens: 8400, budget: 16000 };
  yield {
    type: "thinking",
    agent: "research",
    summary: "Multiple sources disagree on bank statement duration. Federal Foreign Office (2025) says 6 months, Embassy Delhi (2023) says 3 months. Resolving by authority and recency — 6 months is correct.",
  };
  await delay(500);

  yield { type: "requirement", item: "Financial proof: 6 months bank statements, €45/day minimum", depth: 5 };
  await delay(300);

  yield { type: "orchestrator", action: "agent_complete", agent: "research", duration_ms: 14200 };
  await delay(500);

  // Document Agent
  yield { type: "orchestrator", action: "agent_start", agent: "document" };
  await delay(300);

  yield { type: "document_read", doc: "Passport", language: "English", docType: "passport" };
  await delay(400);
  yield { type: "document_read", doc: "Bank Statement", language: "Hindi", docType: "bank_statement" };
  await delay(600);
  yield { type: "document_read", doc: "Employment Letter", language: "Hindi", docType: "employment_letter" };
  await delay(500);
  yield { type: "document_read", doc: "Cover Letter", language: "English", docType: "cover_letter" };
  await delay(400);

  // Cross-lingual contradiction
  yield { type: "thinking_depth", agent: "document", tokens: 14200, budget: 16000 };
  yield {
    type: "thinking",
    agent: "document",
    summary: 'Hindi employment letter (Doc 3): "स्थायी कर्मचारी" = permanent employee, ₹85,000/month. English cover letter (Doc 4): "contract consultant," ₹60,000/month. These are contradictory — an embassy officer who reads Hindi will catch this.',
  };
  await delay(300);

  yield {
    type: "cross_lingual",
    finding: "Employment status contradiction: Hindi letter says 'permanent employee' (₹85,000/mo), English cover letter says 'contract consultant' (₹60,000/mo)",
    severity: "critical",
    details: "An embassy officer who reads Hindi will catch this inconsistency.",
  };
  await delay(400);

  yield {
    type: "forensic",
    finding: "Conference invitation sent from Gmail address (easummit2026@gmail.com)",
    severity: "warning",
    details: "Professional conferences use official domains. Gmail suggests informal or fabricated invitation.",
  };
  await delay(300);

  yield { type: "narrative", assessment: "WEAK", issues: 3, details: "3-day conference with 15-day trip, Gmail invitation, low savings ratio" };
  await delay(300);

  yield { type: "orchestrator", action: "agent_complete", agent: "document", duration_ms: 32100 };
  await delay(500);

  // Advisory Agent
  yield { type: "orchestrator", action: "agent_start", agent: "advisory" };
  await delay(300);

  yield {
    type: "recommendation",
    priority: "critical",
    action: "Fix cover letter: change role to 'Permanent Senior Software Engineer' and salary to '₹85,000/month' to match Hindi employment letter",
  };
  await delay(300);

  yield {
    type: "recommendation",
    priority: "critical",
    action: "Get official conference invitation on conference letterhead from an official domain (e.g., @esas-conference.org)",
  };
  await delay(300);

  yield {
    type: "recommendation",
    priority: "warning",
    action: "Add a day-by-day itinerary explaining the 12 days beyond the conference (tourism, business meetings, etc.)",
  };
  await delay(300);

  yield { type: "assessment", overall: "ADDITIONAL_DOCUMENTS_NEEDED" };
  await delay(200);

  yield { type: "orchestrator", action: "agent_complete", agent: "advisory", duration_ms: 11500 };

  // Complete
  yield {
    type: "complete",
    data: {},
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
