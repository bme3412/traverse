/**
 * Translation API Endpoint
 *
 * Translates all visible text on the visa requirements page in a single call:
 * - UI chrome strings (buttons, labels, headings)
 * - Requirement names and descriptions (dynamic content)
 * - Corridor info (visa type, corridor name)
 *
 * Uses Claude to produce natural, formal-register translations.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getEnv, isDevelopment } from "@/lib/env";
import { checkRateLimit, createRateLimitResponse, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: getEnv().ANTHROPIC_API_KEY,
});

interface TranslateRequestBody {
  language: string;
  uiStrings?: Record<string, string>;
  items?: { name: string; description: string }[];
  corridorInfo?: { corridor: string; visaType: string };
  importantNotes?: string[];
  /** Dynamic content from live feed (status updates, thinking panel text) */
  dynamicTexts?: string[];
}

export async function POST(request: Request) {
  // Apply rate limiting (30 requests per minute for translation)
  const rateLimit = checkRateLimit(request, RATE_LIMIT_PRESETS.STANDARD);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  let body: TranslateRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { language, uiStrings, items, corridorInfo, importantNotes, dynamicTexts } = body;

  // Log requests for debugging
  if (isDevelopment()) {
    console.log("[Translate API] Request body:", {
      language,
      hasUiStrings: !!uiStrings,
      hasItems: !!items,
      hasCorridorInfo: !!corridorInfo,
      hasImportantNotes: !!importantNotes,
      hasDynamicTexts: !!dynamicTexts,
      dynamicTextsCount: dynamicTexts?.length || 0,
    });
  }

  if (!language || language === "English") {
    if (isDevelopment()) {
      console.error("[Translate API] 400 - Missing or English language. Body:", body);
    }
    return new Response(
      JSON.stringify({ error: "Non-English language is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Build the payload to translate
    const payload: Record<string, unknown> = {};

    if (uiStrings && Object.keys(uiStrings).length > 0) {
      payload.uiStrings = uiStrings;
    }
    if (items && items.length > 0) {
      payload.items = items.map((item) => ({
        name: item.name,
        description: item.description,
      }));
    }
    if (corridorInfo) {
      payload.corridorInfo = corridorInfo;
    }
    if (importantNotes?.length) {
      payload.importantNotes = importantNotes;
    }
    if (dynamicTexts && dynamicTexts.length > 0) {
      payload.dynamicTexts = dynamicTexts;
    }

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-6",
      max_tokens: 16384,
      system: `You are a professional translator specializing in immigration and visa terminology. Translate the following JSON data into ${language}.

Rules:
- Translate ALL string values naturally into ${language}.
- For "uiStrings": translate each VALUE (the values are UI labels, buttons, headings). Keep the KEYS exactly the same (they are lookup identifiers). Translate every single value — do not skip any.
- For "items": translate both "name" and "description" fields of each item.
- For "corridorInfo": translate "corridor" and "visaType". Keep the arrow symbol (→) in corridor names.
- For "importantNotes": translate each note string.
- For "dynamicTexts": translate each string in the array. Return the same-length array with translated strings. These are status messages from a visa research tool — keep URLs, dates, currency amounts, and document codes intact. Translate the natural language portions.
- DO NOT translate proper nouns like specific country names, organization names, or document codes (e.g., "DS-160", "Schengen").
- Use the formal register appropriate for official/government context in ${language}.
- Return ONLY valid JSON with the exact same structure. No markdown fences, no explanation, no extra text.`,
      messages: [
        {
          role: "user",
          content: `Translate everything to ${language}:\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonText = textBlock.text.trim();

    // First, try to remove markdown code fences if present
    const markdownMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (markdownMatch) {
      jsonText = markdownMatch[1].trim();
    } else {
      // If no markdown fences, try to extract just the JSON object
      const rawJsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (rawJsonMatch) {
        jsonText = rawJsonMatch[0];
      }
    }

    const translated = JSON.parse(jsonText);

    return new Response(JSON.stringify(translated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (isDevelopment()) {
      console.error("[Translate API] Error:", error);
    }
    return new Response(
      JSON.stringify({
        error: "Translation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
