import { sseResponse } from "@/lib/sse";
import { SSEEvent, UploadedDocument, DocumentExtraction, RequirementItem } from "@/lib/types";
import { runSingleDocumentRead, runIncrementalCrossCheck } from "@/lib/agents/document";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Per-document analysis endpoint.
 * Accepts a single document + the requirement it's uploaded for + previous extractions.
 * Runs Pass 1 (vision read) then incremental cross-check.
 * Returns SSE stream with thinking updates and final result.
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

  const document = body.document as UploadedDocument;
  const requirement = body.requirement as RequirementItem;
  const previousExtractions = (body.previousExtractions || []) as DocumentExtraction[];

  if (!document || !requirement) {
    return new Response(
      JSON.stringify({ error: "Missing document or requirement" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return sseResponse(() =>
    perDocumentAnalysis(document, requirement, previousExtractions)
  );
}

async function* perDocumentAnalysis(
  document: UploadedDocument,
  requirement: RequirementItem,
  previousExtractions: DocumentExtraction[]
): AsyncGenerator<SSEEvent, void, unknown> {
  // Signal start
  yield {
    type: "doc_analysis_start",
    requirementName: requirement.name,
    docFilename: document.filename,
  };

  // Pass 1: Vision read (single doc)
  yield {
    type: "doc_analysis_thinking",
    requirementName: requirement.name,
    excerpt: `Reading document...`,
  };

  const extraction = await runSingleDocumentRead(document);

  yield {
    type: "doc_analysis_thinking",
    requirementName: requirement.name,
    excerpt: `Read complete: ${extraction.docType} (${extraction.language}). Cross-checking against "${requirement.name}"...`,
  };

  // Pass 2: Incremental cross-check
  const crossCheckGen = runIncrementalCrossCheck(
    extraction,
    requirement,
    previousExtractions
  );

  let crossCheckResult;
  while (true) {
    const result = await crossCheckGen.next();
    if (result.done) {
      crossCheckResult = result.value;
      break;
    }
    yield result.value;
  }

  // Final result
  yield {
    type: "doc_analysis_result",
    requirementName: requirement.name,
    extraction,
    compliance: crossCheckResult.compliance,
    crossDocFindings:
      crossCheckResult.crossDocFindings.length > 0
        ? crossCheckResult.crossDocFindings
        : undefined,
  };
}
