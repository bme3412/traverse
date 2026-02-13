/**
 * Document Intelligence Agent — Agent 2 of 3
 *
 * Pass 1: Parallel vision reads - extract text from each document
 * Pass 2: Cross-document analysis - compliance, cross-lingual, narrative, forensics
 *
 * Uses Claude Opus 4.5 with vision and extended thinking.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import {
  UploadedDocument,
  DocumentExtraction,
  DocumentAnalysis,
  RequirementsChecklist,
  RequirementItem,
  SSEEvent,
  ComplianceResult,
  ComplianceItem,
  CrossLingualFinding,
  CrossDocFinding,
  NarrativeAssessment,
  ForensicFlag,
} from "../types";
import type { ThinkingDelta, TextDelta } from "../../types/anthropic";
import { AI_CONFIG, STREAMING_CONFIG } from "../config";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Pass 1: Parallel Vision Reads
 * Reads each document in parallel, extracts text, identifies type and language.
 */
export async function* runDocumentReaderPass1(
  documents: UploadedDocument[]
): AsyncGenerator<SSEEvent, DocumentExtraction[], unknown> {
  const startTime = Date.now();

  yield {
    type: "orchestrator",
    action: "agent_start",
    agent: "Document Agent (Reading)",
    message: `Reading ${documents.length} documents...`,
  };

  // Fire off all reads in parallel
  const readPromises = documents.map(async (doc, index) => {
    const readStart = Date.now();

    try {
      const response = await anthropic.messages.create({
        model: AI_CONFIG.MODEL,
        max_tokens: AI_CONFIG.DOCUMENT_READ_MAX_TOKENS,
        thinking: {
          type: "adaptive",
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: doc.mimeType,
                  data: doc.base64,
                },
              },
              {
                type: "text",
                text: `Read this document carefully and extract all information.

Tasks:
1. Extract ALL text from the document (word-for-word transcription)
2. Identify the document type (passport, bank_statement, employment_letter, cover_letter, invitation_letter, flight_booking, hotel_booking, insurance_policy, tax_return, etc.)
3. Identify the primary language
4. Extract structured data (dates, amounts, names, etc.)

Return a JSON object with this structure:
{
  "docType": "document_type",
  "language": "primary language",
  "extractedText": "complete verbatim transcription",
  "structuredData": {
    // Key-value pairs of important data
  }
}`,
              },
            ],
          },
        ],
      });

      // Parse response
      const textContent = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as TextBlock).text)
        .join("");

      // Extract JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      interface ParsedExtraction {
        docType?: string;
        language?: string;
        extractedText?: string;
        structuredData?: Record<string, unknown>;
      }
      let parsed: ParsedExtraction = {};
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as ParsedExtraction;
        } catch {
          // Parsing failed, use defaults
        }
      }

      const extraction: DocumentExtraction = {
        id: doc.id,
        docType: parsed.docType || "unknown",
        language: parsed.language || "Unknown",
        extractedText: parsed.extractedText || textContent,
        structuredData: parsed.structuredData || {},
      };

      const readDuration = Date.now() - readStart;

      return {
        extraction,
        event: {
          type: "document_read" as const,
          doc: doc.filename,
          language: extraction.language,
          docType: extraction.docType,
          duration_ms: readDuration,
        },
      };
    } catch (error) {
      return {
        extraction: {
          id: doc.id,
          docType: "error",
          language: "Unknown",
          extractedText: "",
          structuredData: { error: error instanceof Error ? error.message : "Unknown error" },
        },
        event: {
          type: "document_read" as const,
          doc: doc.filename,
          language: "Error",
          docType: "error",
          duration_ms: 0,
        },
      };
    }
  });

  // Wait for all reads to complete and yield events as they finish
  const results = await Promise.all(readPromises);

  // Yield events with delays for progressive UX
  const extractions: DocumentExtraction[] = [];
  for (const result of results) {
    extractions.push(result.extraction);
    yield result.event;
    await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.DOCUMENT_READ_DELAY_MS));
  }

  const duration = Date.now() - startTime;
  yield {
    type: "orchestrator",
    action: "agent_complete",
    agent: "Document Agent (Reading)",
    message: `Read ${documents.length} documents in ${(duration / 1000).toFixed(1)}s`,
    duration_ms: duration,
  };

  return extractions;
}

/**
 * Pass 2: Cross-Document Analysis
 * Analyzes all extracted documents for compliance, cross-lingual issues, narrative, forensics.
 */
export async function* runDocumentAnalyzerPass2(
  extractions: DocumentExtraction[],
  requirements: RequirementsChecklist
): AsyncGenerator<SSEEvent, DocumentAnalysis, unknown> {
  const startTime = Date.now();

  yield {
    type: "orchestrator",
    action: "agent_start",
    agent: "Document Agent (Analysis)",
    message: "Analyzing documents for compliance and issues...",
  };

  // Build the analysis prompt
  const extractionsText = extractions
    .map((ext, i) => {
      return `--- DOCUMENT ${i + 1}: ${ext.docType} (${ext.language}) ---
${ext.extractedText}
`;
    })
    .join("\n\n");

  const requirementsText = requirements.items
    .map((item, i) => `${i + 1}. ${item.name}: ${item.description}`)
    .join("\n");

  const systemPrompt = `You are a document analysis expert. You will analyze visa application documents for compliance, cross-lingual contradictions, narrative coherence, and forensic issues.

REQUIREMENTS TO CHECK:
${requirementsText}

ANALYSIS TASKS:

1. **Compliance Check**: For each requirement, determine if the uploaded documents satisfy it.
   - "met": Requirement satisfied by documents
   - "warning": Partially satisfied or unclear
   - "critical": Missing or clearly not satisfied
   - "not_checked": Cannot determine from documents

2. **Cross-Lingual Contradiction Detection**: If documents are in multiple languages, check if the semantic meaning is consistent across languages. This is CRITICAL.
   - Example: Hindi document says "स्थायी कर्मचारी" (permanent employee) but English document says "contract consultant"
   - Look for: employment status, salary amounts, job titles, dates, relationships

3. **Narrative Coherence**: Does the complete document set tell a consistent, plausible story?
   - Trip duration vs stated purpose
   - Financial capacity vs trip cost
   - Professional role vs invitation
   - Timeline consistency

4. **Document Forensics**: Look for red flags:
   - Personal email addresses for professional correspondence (Gmail, Yahoo, etc.)
   - Screenshots instead of PDFs
   - Inconsistent formatting
   - Suspicious amounts or dates
   - Missing official letterheads or stamps

IMPORTANT: Stream your findings incrementally. As you discover each issue, return it immediately. Do not wait until the end.

Return your analysis as JSON:
{
  "compliance": {
    "met": number,
    "warnings": number,
    "critical": number,
    "items": [
      {
        "requirement": "requirement name",
        "status": "met|warning|critical|not_checked",
        "detail": "explanation",
        "documentRef": "document type that addresses this"
      }
    ]
  },
  "crossLingualFindings": [
    {
      "severity": "critical|warning|info",
      "finding": "brief description",
      "doc1": { "id": "...", "language": "...", "text": "relevant excerpt" },
      "doc2": { "id": "...", "language": "...", "text": "relevant excerpt" },
      "reasoning": "why this is a contradiction"
    }
  ],
  "narrativeAssessment": {
    "strength": "WEAK|MODERATE|STRONG",
    "issues": [
      {
        "category": "category",
        "description": "description",
        "severity": "critical|warning|info"
      }
    ],
    "summary": "overall assessment"
  },
  "forensicFlags": [
    {
      "severity": "critical|warning|info",
      "finding": "brief description",
      "detail": "full explanation",
      "documentRef": "document type"
    }
  ]
}`;

  try {
    const stream = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: AI_CONFIG.DOCUMENT_ANALYSIS_MAX_TOKENS,
      thinking: {
        type: "adaptive",
      },
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here are the extracted documents to analyze:

${extractionsText}

Analyze these documents against the requirements. Look carefully for cross-lingual contradictions, narrative issues, and forensic red flags. Return your complete analysis as JSON.`,
        },
      ],
      stream: true, // CRITICAL: Enable streaming to avoid 10-minute timeout
    });

    // Accumulate response from stream, streaming real thinking text
    let textContent = "";
    let thinkingTokens = 0;
    let thinkingBuffer = "";
    let lastEmitTime = 0;
    let lastEmitLen = 0;
    let textChars = 0;
    let lastTextEmitTime = 0;
    let thinkingDone = false;
    let textOutputStarted = false;

    for await (const chunk of stream) {
      // Detect content block lifecycle
      if (chunk.type === "content_block_start") {
        const content = chunk.content_block;
        if (content.type === "thinking") {
          thinkingDone = false;
          yield {
            type: "thinking",
            agent: "Document Agent (Analysis)",
            summary: "Analyzing documents",
            excerpt: "Cross-referencing documents against requirements...\n",
          };
          lastEmitTime = Date.now();
          lastEmitLen = 0;
        }
        if (content.type === "text") {
          // Only treat as real text output if thinking already happened
          if (thinkingBuffer.length > 100 || textChars > 100) {
            textOutputStarted = true;
            lastTextEmitTime = Date.now();
            const transitionExcerpt = thinkingBuffer.length > 0
              ? thinkingBuffer.slice(-2500) + "\n\n— Compiling document analysis..."
              : "Compiling document analysis...";
            yield {
              type: "thinking",
              agent: "Document Agent (Analysis)",
              summary: "Compiling analysis",
              excerpt: transitionExcerpt,
            };
          }
        }
      }

      // When thinking block closes, show last state
      if (chunk.type === "content_block_stop" && !thinkingDone && thinkingBuffer.length > 0) {
        thinkingDone = true;
        if (!textOutputStarted) {
          yield {
            type: "thinking",
            agent: "Document Agent (Analysis)",
            summary: "Reasoning complete",
            excerpt: thinkingBuffer.slice(-3000),
          };
        }
      }

      if (chunk.type === "content_block_delta") {
        const delta = chunk.delta;

        // Accumulate real thinking text and stream it continuously
        if (delta.type === "thinking_delta") {
          const thinkingDelta = delta as ThinkingDelta;
          const text = thinkingDelta.delta?.thinking || thinkingDelta.thinking || "";
          thinkingBuffer += text;
          thinkingTokens += text.length;

          // Emit thinking_depth every ~2000 chars
          if (thinkingTokens > 0 && thinkingTokens % 2000 < 50) {
            yield {
              type: "thinking_depth",
              agent: "Document Agent (Analysis)",
              tokens: thinkingTokens,
              budget: AI_CONFIG.THINKING_BUDGET,
            };
          }

          // Stream thinking text — emit when enough time AND enough new chars
          const now = Date.now();
          const newChars = thinkingBuffer.length - lastEmitLen;
          if (now - lastEmitTime >= STREAMING_CONFIG.EMIT_INTERVAL_MS && newChars >= STREAMING_CONFIG.MIN_NEW_CHARS) {
            yield {
              type: "thinking",
              agent: "Document Agent (Analysis)",
              summary: "Analyzing documents",
              excerpt: thinkingBuffer.slice(-3000),
            };
            lastEmitTime = now;
            lastEmitLen = thinkingBuffer.length;
          }
        }

        // Text accumulation + progress during output phase
        if (delta.type === "text_delta") {
          const textDelta = delta as TextDelta;
          const text = textDelta.delta?.text || textDelta.text || "";
          textContent += text;
          textChars += text.length;

          const now = Date.now();
          if (now - lastTextEmitTime >= STREAMING_CONFIG.TEXT_PROGRESS_MS) {
            const kbWritten = (textChars / 1024).toFixed(1);
            const baseExcerpt = thinkingBuffer.length > 0
              ? thinkingBuffer.slice(-2000)
              : "";
            yield {
              type: "thinking",
              agent: "Document Agent (Analysis)",
              summary: "Compiling analysis",
              excerpt: baseExcerpt + `\n\n— Writing document analysis (${kbWritten} KB generated)...`,
            };
            lastTextEmitTime = now;
          }
        }
      }
    }

    // Extract JSON
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    let analysis: DocumentAnalysis;

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      analysis = {
        compliance: parsed.compliance || { met: 0, warnings: 0, critical: 0, items: [] },
        crossLingualFindings: parsed.crossLingualFindings || [],
        narrativeAssessment: parsed.narrativeAssessment || {
          strength: "MODERATE",
          issues: [],
          summary: "Analysis completed",
        },
        forensicFlags: parsed.forensicFlags || [],
      };
    } else {
      // Fallback if JSON parsing fails
      analysis = {
        compliance: { met: 0, warnings: 0, critical: 0, items: [] },
        crossLingualFindings: [],
        narrativeAssessment: {
          strength: "MODERATE",
          issues: [],
          summary: "Could not parse analysis results",
        },
        forensicFlags: [],
      };
    }

    // Stream findings progressively
    // Cross-lingual findings
    for (const finding of analysis.crossLingualFindings) {
      yield {
        type: "cross_lingual",
        finding: finding.finding,
        severity: finding.severity,
        details: finding.reasoning,
      };
      await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.REQUIREMENT_DISPLAY_DELAY_MS));
    }

    // Forensic flags
    for (const flag of analysis.forensicFlags) {
      yield {
        type: "forensic",
        finding: flag.finding,
        severity: flag.severity,
        details: flag.detail,
      };
      await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.REQUIREMENT_DISPLAY_DELAY_MS));
    }

    // Narrative assessment
    yield {
      type: "narrative",
      assessment: analysis.narrativeAssessment.strength,
      issues: analysis.narrativeAssessment.issues.length,
      details: analysis.narrativeAssessment.summary,
    };

    const duration = Date.now() - startTime;
    yield {
      type: "orchestrator",
      action: "agent_complete",
      agent: "Document Agent (Analysis)",
      message: `Analysis complete in ${(duration / 1000).toFixed(1)}s`,
      duration_ms: duration,
    };

    return analysis;
  } catch (error) {
    yield {
      type: "error",
      message: `Document analysis error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };

    // Return empty analysis
    return {
      compliance: { met: 0, warnings: 0, critical: 0, items: [] },
      crossLingualFindings: [],
      narrativeAssessment: {
        strength: "MODERATE",
        issues: [],
        summary: "Analysis failed",
      },
      forensicFlags: [],
    };
  }
}

// ============================================================
// Per-Document Analysis (incremental upload flow)
// ============================================================

/**
 * Single-document Pass 1: Vision read for one document.
 * Returns extraction result without streaming (fast, ~5-10s).
 */
export async function runSingleDocumentRead(
  document: UploadedDocument
): Promise<DocumentExtraction> {
  try {
    const response = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: AI_CONFIG.DOCUMENT_READ_MAX_TOKENS,
      thinking: {
        type: "adaptive",
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: document.mimeType,
                data: document.base64,
              },
            },
            {
              type: "text",
              text: `Read this document and extract all information.

Return JSON:
{
  "docType": "passport|bank_statement|employment_letter|cover_letter|invitation_letter|flight_booking|hotel_booking|insurance_policy|tax_return|photo|other",
  "language": "primary language",
  "extractedText": "verbatim transcription",
  "structuredData": { key-value pairs of important data }
}`,
            },
          ],
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as TextBlock).text)
      .join("");

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    interface ParsedExtraction {
      docType?: string;
      language?: string;
      extractedText?: string;
      structuredData?: Record<string, unknown>;
    }
    let parsed: ParsedExtraction = {};
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]) as ParsedExtraction;
      } catch {
        // Parsing failed
      }
    }

    return {
      id: document.id,
      docType: parsed.docType || "unknown",
      language: parsed.language || "Unknown",
      extractedText: parsed.extractedText || textContent,
      structuredData: parsed.structuredData || {},
    };
  } catch (error) {
    return {
      id: document.id,
      docType: "error",
      language: "Unknown",
      extractedText: "",
      structuredData: { error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

/**
 * Incremental cross-document check.
 * Checks one new document against a specific requirement + all previously analyzed documents.
 * Streams thinking via SSE events.
 */
export async function* runIncrementalCrossCheck(
  newExtraction: DocumentExtraction,
  requirement: RequirementItem,
  previousExtractions: DocumentExtraction[]
): AsyncGenerator<SSEEvent, { compliance: ComplianceItem; crossDocFindings: CrossDocFinding[] }, unknown> {
  const hasPrevious = previousExtractions.length > 0;

  const previousContext = hasPrevious
    ? previousExtractions
        .map((ext, i) => `--- PREVIOUS DOC ${i + 1}: ${ext.docType} (${ext.language}) ---\n${ext.extractedText.slice(0, 1500)}`)
        .join("\n\n")
    : "";

  const prompt = `You are checking a visa application document against a specific requirement.

REQUIREMENT: ${requirement.name}
${requirement.description}

NEW DOCUMENT (${newExtraction.docType}, ${newExtraction.language}):
${newExtraction.extractedText.slice(0, 3000)}

${hasPrevious ? `PREVIOUSLY ANALYZED DOCUMENTS:\n${previousContext}\n\nCheck for contradictions between the new document and previous documents (dates, names, amounts, employment status, etc.).` : ""}

Return JSON:
{
  "compliance": {
    "requirement": "${requirement.name}",
    "status": "met|warning|critical",
    "detail": "brief explanation of how the document satisfies or fails this requirement",
    "documentRef": "${newExtraction.docType}"
  },
  "crossDocFindings": [
    {
      "severity": "critical|warning|info",
      "finding": "brief description",
      "detail": "explanation"
    }
  ]
}

If no cross-document issues, return an empty crossDocFindings array.`;

  try {
    const stream = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: 4000,
      thinking: {
        type: "adaptive",
      },
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: true,
    });

    let textContent = "";
    let thinkingBuffer = "";
    let lastEmitTime = 0;
    let lastEmitLen = 0;
    let textChars = 0;

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta") {
        const delta = chunk.delta;

        if (delta.type === "thinking_delta") {
          const thinkingDelta = delta as ThinkingDelta;
          const text = thinkingDelta.delta?.thinking || thinkingDelta.thinking || "";
          thinkingBuffer += text;

          const now = Date.now();
          const newChars = thinkingBuffer.length - lastEmitLen;
          if (now - lastEmitTime >= 300 && newChars >= 60) {
            yield {
              type: "doc_analysis_thinking",
              requirementName: requirement.name,
              excerpt: thinkingBuffer.slice(-2000),
            };
            lastEmitTime = now;
            lastEmitLen = thinkingBuffer.length;
          }
        }

        if (delta.type === "text_delta") {
          const textDelta = delta as TextDelta;
          const text = textDelta.delta?.text || textDelta.text || "";
          textContent += text;
          textChars += text.length;
        }
      }
    }

    // Parse result
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        compliance: parsed.compliance || {
          requirement: requirement.name,
          status: "not_checked" as const,
          detail: "Could not analyze",
          documentRef: newExtraction.docType,
        },
        crossDocFindings: parsed.crossDocFindings || [],
      };
    }

    return {
      compliance: {
        requirement: requirement.name,
        status: "not_checked" as const,
        detail: "Could not parse analysis",
        documentRef: newExtraction.docType,
      },
      crossDocFindings: [],
    };
  } catch (error) {
    yield {
      type: "error",
      message: `Cross-check error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };

    return {
      compliance: {
        requirement: requirement.name,
        status: "not_checked" as const,
        detail: "Analysis failed",
        documentRef: newExtraction.docType,
      },
      crossDocFindings: [],
    };
  }
}

