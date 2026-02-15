/**
 * Research Agent — Agent 1 of 3
 *
 * Takes travel corridor details, searches live government sources,
 * and returns structured visa requirements.
 *
 * Uses Claude Opus 4.6 with extended thinking + web search.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  TravelDetails,
  RequirementsChecklist,
  RequirementItem,
  SSEEvent,
} from "../types";
import type { ThinkingDelta, TextDelta } from "../../types/anthropic";
import { AI_CONFIG, STREAMING_CONFIG, CACHE_CONFIG } from "../config";
import { getEnv, isDevelopment } from "../env";
import { promises as fs } from "fs";
import path from "path";

const anthropic = new Anthropic({
  apiKey: getEnv().ANTHROPIC_API_KEY,
});

// Timing helper for performance diagnosis
function elapsed(start: number, label: string): void {
  if (isDevelopment()) {
    const ms = Date.now() - start;
    console.log(`[Research Agent] ${label} @ +${(ms / 1000).toFixed(1)}s`);
  }
}

/**
 * Loads cached requirements data if available.
 * Returns null if no cache exists for this corridor.
 */
async function loadCachedRequirements(
  corridor: string
): Promise<RequirementsChecklist | null> {
  try {
    // Normalize corridor string to filename (e.g., "India → Germany" -> "india-germany")
    const filename = corridor
      .toLowerCase()
      .replace(/\s*→\s*/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const cachePath = path.join(
      process.cwd(),
      "data",
      "corridors",
      `${filename}.json`
    );

    const data = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(data) as RequirementsChecklist;
  } catch (error) {
    // No cache available
    return null;
  }
}

/**
 * Personalizes cached requirements with user-specific details.
 */
function personalizeCachedRequirements(
  cached: RequirementsChecklist,
  travel: TravelDetails,
  requiredValidUntil: Date
): RequirementsChecklist {
  const tripDays = Math.ceil(
    (new Date(travel.dates.return).getTime() - new Date(travel.dates.depart).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  const personalizedItems = cached.items.map((item) => {
    // Personalize passport validity
    if (item.name.toLowerCase().includes("passport") && item.name.toLowerCase().includes("valid")) {
      return {
        ...item,
        personalizedDetail: `Passport must be valid until at least ${requiredValidUntil.toISOString().split("T")[0]} (6 months after return)`,
      };
    }

    // Personalize travel dates
    if (item.name.toLowerCase().includes("itinerary") || item.name.toLowerCase().includes("flight")) {
      return {
        ...item,
        personalizedDetail: `Flight bookings for ${travel.dates.depart} to ${travel.dates.return}`,
      };
    }

    // Personalize accommodation
    if (item.name.toLowerCase().includes("accommodation") || item.name.toLowerCase().includes("hotel")) {
      return {
        ...item,
        personalizedDetail: `Bookings covering all ${tripDays} nights (${travel.dates.depart} to ${travel.dates.return})`,
      };
    }

    // Personalize financial requirements
    if (item.name.toLowerCase().includes("bank") || item.name.toLowerCase().includes("fund") || item.name.toLowerCase().includes("financial")) {
      return {
        ...item,
        personalizedDetail: item.personalizedDetail?.replace(/\d+-day/, `${tripDays}-day`) || item.personalizedDetail,
      };
    }

    // Personalize insurance
    if (item.name.toLowerCase().includes("insurance")) {
      return {
        ...item,
        personalizedDetail: `Coverage required: ${travel.dates.depart} to ${travel.dates.return} (${tripDays} days)`,
      };
    }

    return item;
  });

  // Personalize financial thresholds for trip duration
  let financialThresholds = cached.financialThresholds;
  if (financialThresholds?.dailyMinimum && financialThresholds.dailyMinimum !== "N/A (lump-sum requirement)") {
    // Try to compute a personalized total from the daily minimum
    const dailyMatch = financialThresholds.dailyMinimum.match(/[\d,.]+/);
    if (dailyMatch) {
      const dailyMin = parseFloat(dailyMatch[0].replace(",", ""));
      const total = Math.round(dailyMin * tripDays);
      financialThresholds = {
        ...financialThresholds,
        totalRecommended: `${financialThresholds.currency || ""} ${total.toLocaleString()}+ for ${tripDays} days`.trim(),
      };
    }
  }

  return {
    ...cached,
    items: personalizedItems,
    financialThresholds,
  };
}

/**
 * Main Research Agent function.
 * Yields SSE events as it searches and processes information.
 */
export async function* runResearchAgent(
  travelDetails: TravelDetails
): AsyncGenerator<SSEEvent, RequirementsChecklist, unknown> {
  const startTime = Date.now();

  // Build the corridor description
  const passportStr = travelDetails.passports.length === 1
    ? travelDetails.passports[0]
    : travelDetails.passports.join(" or ");
  const corridor = `${passportStr} → ${travelDetails.destination}`;

  yield {
    type: "orchestrator",
    action: "agent_start",
    agent: "Research Agent",
    message: `Researching requirements for ${corridor}`,
  };

  // Calculate visa validity requirement (passport valid 6 months after return)
  const returnDate = new Date(travelDetails.dates.return);
  const requiredValidUntil = new Date(returnDate);
  requiredValidUntil.setMonth(requiredValidUntil.getMonth() + 6);

  // Build the system prompt
  const systemPrompt = buildSystemPrompt(travelDetails, corridor, requiredValidUntil);

  // Try to load cached data first (for demo reliability)
  const cached = await loadCachedRequirements(corridor);

  // For demo reliability: if cached data exists, use it directly
  // Set USE_LIVE_SEARCH=true in env to force live API calls
  const useLiveSearch = process.env.USE_LIVE_SEARCH === "true";

  if (cached && !useLiveSearch) {
    const destination = travelDetails.destination;
    const sources = cached.sources || [];
    const tripDays = Math.ceil(
      (new Date(travelDetails.dates.return).getTime() - new Date(travelDetails.dates.depart).getTime()) /
      (1000 * 60 * 60 * 24)
    );

    // Build a narrative thinking walkthrough from cached data
    let thinkingText = "";
    const purpose = travelDetails.purpose.replace("_", " ");

    // ── Phase 1: Opening — set the scene ──
    thinkingText += `Searching for ${purpose} visa requirements: ${corridor}.\n`;
    thinkingText += `Trip dates: ${travelDetails.dates.depart} to ${travelDetails.dates.return} (${tripDays} days).\n`;

    yield {
      type: "thinking",
      agent: "Research Agent",
      summary: "Searching",
      excerpt: thinkingText,
    };

    // ── Phase 1b: Source discovery — staggered for organic pacing ──
    for (const source of sources) {
      yield { type: "search_status", source: source.name, status: "searching", url: source.url };
      await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.EMIT_INTERVAL_MS));
      yield { type: "search_status", source: source.name, status: "found", url: source.url };
      await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.SHORT_DELAY_MS));
    }

    thinkingText += `\nFound ${sources.length} official sources. Cross-referencing requirements.\n`;

    yield {
      type: "thinking",
      agent: "Research Agent",
      summary: "Sources found",
      excerpt: thinkingText,
    };
    await new Promise(resolve => setTimeout(resolve, 300));

    // ── Phase 2: Visa type — the key discovery ──
    thinkingText += `\n§ VISA TYPE\n`;
    thinkingText += `${cached.visaType}`;
    if (cached.fees?.visa) thinkingText += ` — fee: ${cached.fees.visa}`;
    thinkingText += `\n`;
    if (cached.processingTime) thinkingText += `Processing: ${cached.processingTime}\n`;
    if (cached.applyAt) thinkingText += `Where to apply: ${cached.applyAt}\n`;

    if (cached.applicationWindow) {
      thinkingText += `Application window: submit ${cached.applicationWindow.latest} before travel (earliest: ${cached.applicationWindow.earliest})\n`;
    }

    yield {
      type: "thinking",
      agent: "Research Agent",
      summary: cached.visaType,
      excerpt: thinkingText,
    };
    await new Promise(resolve => setTimeout(resolve, 400));

    // ── Phase 3: Requirements breakdown ──
    const requiredItems = cached.items.filter(i => i.required);
    const optionalItems = cached.items.filter(i => !i.required);

    thinkingText += `\n§ REQUIRED DOCUMENTS (${requiredItems.length})\n`;
    for (const item of requiredItems) {
      thinkingText += `• ${item.name} — ${item.description}\n`;
    }
    if (optionalItems.length > 0) {
      thinkingText += `\n§ RECOMMENDED (${optionalItems.length})\n`;
      for (const item of optionalItems) {
        thinkingText += `• ${item.name} — ${item.description}\n`;
      }
    }

    yield {
      type: "thinking",
      agent: "Research Agent",
      summary: `${requiredItems.length} required, ${optionalItems.length} recommended`,
      excerpt: thinkingText,
    };
    await new Promise(resolve => setTimeout(resolve, 400));

    // ── Phase 4: Personalization + corridor intelligence ──
    const personalized = personalizeCachedRequirements(
      cached,
      travelDetails,
      requiredValidUntil
    );

    thinkingText += `\n§ PERSONALIZING FOR THIS TRIP\n`;
    thinkingText += `Passport must be valid until ${requiredValidUntil.toISOString().split("T")[0]}.\n`;

    if (personalized.financialThresholds) {
      const ft = personalized.financialThresholds;
      if (ft.dailyMinimum && ft.dailyMinimum !== "N/A (lump-sum requirement)") {
        thinkingText += `Financial proof: ${ft.dailyMinimum}`;
        if (ft.totalRecommended) thinkingText += ` (${ft.totalRecommended})`;
        thinkingText += `.\n`;
      } else if (ft.totalRecommended) {
        thinkingText += `Financial proof: ${ft.totalRecommended}.\n`;
      }
      if (ft.notes) thinkingText += `${ft.notes}\n`;
    }

    if (cached.documentLanguage) {
      const dl = cached.documentLanguage;
      let langLine = `Documents accepted in: ${dl.accepted.join(", ")}`;
      if (dl.translationRequired) {
        langLine += dl.certifiedTranslation ? `. Certified translation required` : `. Translation required`;
      }
      thinkingText += `${langLine}.\n`;
    }

    if (cached.importantNotes?.length) {
      for (const note of cached.importantNotes) {
        thinkingText += `${note}\n`;
      }
    }

    yield {
      type: "thinking",
      agent: "Research Agent",
      summary: "Personalizing",
      excerpt: thinkingText,
    };
    await new Promise(resolve => setTimeout(resolve, 300));

    // ── Phase 5: Rejection risks — the cautionary note ──
    if (cached.commonRejectionReasons?.length) {
      thinkingText += `\n§ WATCH OUT\n`;
      thinkingText += `Common reasons applications on this corridor get rejected:\n`;
      for (const reason of cached.commonRejectionReasons) {
        thinkingText += `⚠ ${reason}\n`;
      }

      yield {
        type: "thinking",
        agent: "Research Agent",
        summary: "Rejection risks identified",
        excerpt: thinkingText,
      };
      await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.QUARTER_SECOND_MS));
    }

    // Sort: uploadable first, non-uploadable at bottom
    const sortedPersonalized = [...personalized.items].sort((a, b) => {
      const aUp = a.uploadable !== false ? 0 : 1;
      const bUp = b.uploadable !== false ? 0 : 1;
      return aUp - bUp;
    });

    // ── Phase 5: Emit requirements one-by-one (~1-1.5s) ──
    for (const item of sortedPersonalized) {
      yield {
        type: "requirement",
        item: item.name,
        detail: item.description,
        depth: item.required ? 2 : 1,
        source: item.source,
        uploadable: item.uploadable ?? true,
      };
      await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.VERY_SHORT_DELAY_MS));
    }

    // Final thinking state
    thinkingText += `\n§ DONE\n`;
    thinkingText += `${personalized.items.length} requirements identified from ${sources.length} sources. Ready for document verification.`;

    yield {
      type: "thinking",
      agent: "Research Agent",
      summary: "Research complete",
      excerpt: thinkingText,
    };

    // Emit source citations with full URLs
    if (sources.length > 0) {
      yield { type: "sources", sources };
    }

    const duration = Date.now() - startTime;
    yield {
      type: "orchestrator",
      action: "agent_complete",
      agent: "Research Agent",
      message: `Research complete in ${(duration / 1000).toFixed(1)}s`,
      duration_ms: duration,
    };

    return personalized;
  }

  try {
    // Stream the Anthropic API call
    // Note: Using adaptive thinking (recommended for Opus 4.6)
    elapsed(startTime, "Creating Anthropic stream...");
    const stream = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: AI_CONFIG.RESEARCH_MAX_TOKENS,
      thinking: {
        type: "adaptive",
      },
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(travelDetails),
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
    let textChars = 0;
    let lastTextEmitTime = 0;
    let toolUseCount = 0;
    let thinkingDone = false;
    let textOutputStarted = false;
    let firstDelta = true;
    let streamEventCount = 0;
    let incrementalEmitted = 0; // Track how many items we've already emitted incrementally
    const destination = travelDetails.destination;

    // Process the stream
    for await (const event of stream) {
      streamEventCount++;
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
            agent: "Research Agent",
            summary: "Analyzing visa requirements",
            excerpt: `Researching ${corridor} requirements...\n`,
          };
          lastEmitTime = Date.now();
          lastEmitLen = 0;
        }
        if (content.type === "text") {
          elapsed(startTime, `TEXT BLOCK START (thinking=${thinkingTokens} chars, textSoFar=${textChars} chars)`);
          // Adaptive thinking interleaves: text(2 chars) -> thinking -> text(real JSON)
          // Only treat as "real" text output if thinking already happened or significant text accumulated
          if (thinkingBuffer.length > 100 || textChars > 100) {
            textOutputStarted = true;
            lastTextEmitTime = Date.now();
            const transitionExcerpt = thinkingBuffer.length > 0
              ? thinkingBuffer.slice(-8000) + "\n\n— Compiling structured requirements..."
              : "Compiling structured requirements...";
            yield {
              type: "thinking",
              agent: "Research Agent",
              summary: "Compiling results",
              excerpt: transitionExcerpt,
            };
          }
        }
      }

      // When thinking block closes, show last thinking state
      if (event.type === "content_block_stop") {
        elapsed(startTime, `CONTENT BLOCK STOP (thinkingDone=${thinkingDone}, textStarted=${textOutputStarted}, bufLen=${thinkingBuffer.length})`);
        if (!thinkingDone && thinkingBuffer.length > 0) {
          thinkingDone = true;
          // If text output hasn't started yet, this is just thinking finishing
          // If text output already started, this is a no-op transition
          if (!textOutputStarted) {
            yield {
              type: "thinking",
              agent: "Research Agent",
              summary: "Reasoning complete",
              excerpt: thinkingBuffer.slice(-8000),
            };
          }
        }
      }

      if (event.type === "content_block_delta") {
        const delta = event.delta;

        // Accumulate real thinking text and stream it continuously
        if (delta.type === "thinking_delta") {
          const thinkingDelta = delta as ThinkingDelta;
          const chunk = thinkingDelta.delta?.thinking || thinkingDelta.thinking || "";
          thinkingBuffer += chunk;
          thinkingTokens += chunk.length;

          // Log thinking progress every 5000 chars
          if (thinkingTokens > 0 && thinkingTokens % 5000 < 50) {
            elapsed(startTime, `Thinking progress: ${thinkingTokens} chars`);
          }

          // Emit thinking_depth every ~2000 chars
          if (thinkingTokens > 0 && thinkingTokens % 2000 < 50) {
            yield {
              type: "thinking_depth",
              agent: "Research Agent",
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
              agent: "Research Agent",
              summary: "Analyzing visa requirements",
              excerpt: thinkingBuffer.slice(-8000), // Increased from 3000 to show more context
            };
            lastEmitTime = now;
            lastEmitLen = thinkingBuffer.length;
          }
        }

        // Text accumulation + incremental requirement parsing
        if (delta.type === "text_delta") {
          const textDelta = delta as TextDelta;
          const text = textDelta.delta?.text || textDelta.text || "";
          textContent += text;
          textChars += text.length;

          // Log text progress every 5000 chars
          if (textChars > 0 && textChars % 5000 < 50) {
            elapsed(startTime, `Text output progress: ${textChars} chars`);
          }

          // --- Incremental requirement parsing ---
          // As JSON streams in, try to extract complete requirement items
          // and emit them immediately (no waiting for full JSON)
          const newItems = extractIncrementalItems(textContent, incrementalEmitted);
          for (const item of newItems) {
            incrementalEmitted++;
            elapsed(startTime, `Incremental: emitting requirement #${incrementalEmitted}: "${item.name}"`);
            yield {
              type: "requirement",
              item: item.name,
              detail: item.description,
              depth: item.required ? 2 : 1,
              source: item.source,
              uploadable: item.uploadable ?? true,
            };
          }

          // Periodically show the user that structured output is being generated
          const now = Date.now();
          if (now - lastTextEmitTime >= STREAMING_CONFIG.TEXT_PROGRESS_MS) {
            const kbWritten = (textChars / 1024).toFixed(1);
            const reqCount = incrementalEmitted;
            const baseExcerpt = thinkingBuffer.length > 0
              ? thinkingBuffer.slice(-8000)
              : "";
            yield {
              type: "thinking",
              agent: "Research Agent",
              summary: reqCount > 0 ? `Found ${reqCount} requirements so far` : "Compiling results",
              excerpt: baseExcerpt + `\n\n— Writing structured requirements (${kbWritten} KB, ${reqCount} found)...`,
            };
            lastTextEmitTime = now;
          }
        }
      }

      // Handle tool use (web search)
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        toolUseCount++;
        elapsed(startTime, `Tool use #${toolUseCount} started`);
        yield {
          type: "search_status",
          source: `Web search ${toolUseCount}`,
          status: "searching",
        };
      }
    }

    elapsed(startTime, `Stream complete (${streamEventCount} events, thinking=${thinkingTokens} chars, text=${textChars} chars, incremental=${incrementalEmitted})`);

    // Mark initial search as found
    yield { type: "search_status", source: `${destination} visa requirements`, status: "found" };

    // Parse the final response
    elapsed(startTime, "Parsing requirements from text...");
    const requirements = parseRequirementsFromText(
      textContent,
      travelDetails,
      corridor,
      requiredValidUntil
    );
    elapsed(startTime, `Parsed ${requirements.items.length} requirements (${incrementalEmitted} already emitted incrementally)`);

    // Sort: uploadable items first, non-uploadable at bottom
    const sortedItems = [...requirements.items].sort((a, b) => {
      const aUp = a.uploadable !== false ? 0 : 1;
      const bUp = b.uploadable !== false ? 0 : 1;
      return aUp - bUp;
    });

    // Emit only items that weren't already emitted incrementally
    // (incremental emits happen in JSON order; final parse may have cleaned-up versions)
    const remainingItems = sortedItems.slice(incrementalEmitted);
    if (remainingItems.length > 0) {
      elapsed(startTime, `Emitting ${remainingItems.length} remaining requirement items`);
      for (const item of remainingItems) {
        yield {
          type: "requirement",
          item: item.name,
          detail: item.description,
          depth: item.required ? 2 : 1,
          source: item.source,
          uploadable: item.uploadable ?? true,
        };
      }
    }
    elapsed(startTime, "All requirement items emitted");

    // Emit source citations (live path — sources come from parsed requirements)
    if (requirements.sources && requirements.sources.length > 0) {
      // Also emit search_status events so the frontend sourceUrlMap picks up the URLs
      for (const src of requirements.sources) {
        if (src.name && src.url) {
          yield { type: "search_status", source: src.name, status: "found", url: src.url };
        }
      }
      yield { type: "sources", sources: requirements.sources };
    }

    const duration = Date.now() - startTime;
    yield {
      type: "orchestrator",
      action: "agent_complete",
      agent: "Research Agent",
      message: `Research complete in ${(duration / 1000).toFixed(1)}s`,
      duration_ms: duration,
    };

    return requirements;
  } catch (error) {
    // If API fails but we have cached data, use it silently
    if (cached) {
      yield {
        type: "orchestrator",
        action: "agent_complete",
        agent: "Research Agent",
        message: "Using cached requirements data",
      };

      const personalized = personalizeCachedRequirements(
        cached,
        travelDetails,
        requiredValidUntil
      );

      // Emit source URLs so the frontend can build sourceUrlMap for links
      const fallbackSources = cached.sources || [];
      for (const source of fallbackSources) {
        yield { type: "search_status", source: source.name, status: "found", url: source.url };
      }
      if (fallbackSources.length > 0) {
        yield { type: "sources", sources: fallbackSources };
      }

      // Sort: uploadable first, non-uploadable at bottom
      const sortedFallback = [...personalized.items].sort((a, b) => {
        const aUp = a.uploadable !== false ? 0 : 1;
        const bUp = b.uploadable !== false ? 0 : 1;
        return aUp - bUp;
      });

      // Emit requirement items (no delays)
      for (const item of sortedFallback) {
        yield {
          type: "requirement",
          item: item.name,
          detail: item.description,
          depth: item.required ? 2 : 1,
          source: item.source,
          uploadable: item.uploadable ?? true,
        };
      }

      return personalized;
    }

    // No cache available, emit error
    yield {
      type: "error",
      message: `Research Agent error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };

    // Return minimal fallback
    return createFallbackRequirements(travelDetails, corridor, requiredValidUntil);
  }
}

/**
 * Builds the system prompt for the Research Agent.
 */
function buildSystemPrompt(
  travel: TravelDetails,
  corridor: string,
  requiredValidUntil: Date
): string {
  const tripDays = Math.ceil(
    (new Date(travel.dates.return).getTime() - new Date(travel.dates.depart).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  return `You are a visa requirements research agent. Provide requirements for: ${corridor}.

PURPOSE: ${travel.purpose.replace("_", " ")}
DATES: ${travel.dates.depart} to ${travel.dates.return} (${tripDays} days)
TRAVELERS: ${travel.travelers}
${travel.event ? `EVENT: ${travel.event}` : ""}
PASSPORT VALIDITY NEEDED: ${requiredValidUntil.toISOString().split("T")[0]}

Return ONLY a JSON object. Items first, then metadata. 5-8 items focusing on documents the applicant must provide. Include personalizedDetail on every item where you can personalize for the traveler's specific dates/duration/amounts.

{
  "corridor": "${corridor}",
  "visaType": "visa category with code (include local name if applicable)",
  "visaRequired": true/false,
  "items": [
    {"name": "short name", "description": "detailed sentence with specific thresholds/amounts where applicable", "required": true/false, "source": "source name", "confidence": "high|medium", "uploadable": true/false, "personalizedDetail": "personalized for this traveler's dates/duration/amounts or null"}
  ],
  "fees": {"visa": "amount with currency", "service": "amount or null"},
  "processingTime": "estimate",
  "applyAt": "where to apply",
  "importantNotes": ["note"],
  "sources": [{"name": "source", "url": "https://..."}],
  "applicationWindow": {"earliest": "e.g. 6 months before travel", "latest": "e.g. 15 working days before"},
  "commonRejectionReasons": ["reason 1", "reason 2"],
  "financialThresholds": {"dailyMinimum": "amount/day", "totalRecommended": "amount", "currency": "code", "notes": "e.g. held 28 days"},
  "documentLanguage": {"accepted": ["English", "..."], "translationRequired": true/false, "certifiedTranslation": true/false}
}

Rules:
- 5-8 items. Prioritize uploadable documents (passport, financial proof, accommodation, flight, employment, insurance, itinerary). Only include non-uploadable items (web registration, biometric appointment) if critical to entry.
- "uploadable": true if the applicant must provide a physical/digital document (passport, bank statement, letter, photo, insurance). false for actions or conditions (biometric appointment, interview, fee payment).
- "personalizedDetail": personalize EVERY item for this specific traveler using their dates (${travel.dates.depart}–${travel.dates.return}, ${tripDays} days) and passport validity deadline (${requiredValidUntil.toISOString().split("T")[0]}). Include calculated amounts, date ranges, night counts. Set null only when truly not personalizable.
- "sources": 2-4 official references (embassy sites, government portals). Each must have a real "name" and "url". The "source" field in each item should match one of these source names.
- "commonRejectionReasons": 2-3 real reasons specific to this corridor.
- Be concise. Keep descriptions to one sentence. Keep the JSON compact.
- Use factual language only. No political statements.`;
}

/**
 * Builds the user prompt.
 */
function buildUserPrompt(travel: TravelDetails): string {
  const passportStr = travel.passports.length === 1
    ? `I hold a ${travel.passports[0]} passport`
    : `I hold ${travel.passports.join(" and ")} passports`;

  return `${passportStr} and I'm planning to travel to ${travel.destination} for ${travel.purpose.replace("_", " ")} from ${travel.dates.depart} to ${travel.dates.return}. ${travel.event ? `I'll be attending: ${travel.event}. ` : ""}There will be ${travel.travelers} traveler(s).

Please research and provide complete visa requirements for this trip.`;
}

/**
 * Extracts complete requirement items from partial JSON text as it streams in.
 * Returns only NEW items (those beyond `alreadyEmitted` count).
 * 
 * Strategy: find all complete {...} objects within the "items" array portion of the
 * partial JSON, parse each one, and return those we haven't emitted yet.
 */
function extractIncrementalItems(
  partialText: string,
  alreadyEmitted: number
): RequirementItem[] {
  try {
    // Find the "items" array start
    const itemsIdx = partialText.indexOf('"items"');
    if (itemsIdx === -1) return [];

    const bracketIdx = partialText.indexOf('[', itemsIdx);
    if (bracketIdx === -1) return [];

    const afterBracket = partialText.slice(bracketIdx + 1);

    // Extract complete JSON objects by tracking brace depth
    const items: RequirementItem[] = [];
    let depth = 0;
    let objStart = -1;

    for (let i = 0; i < afterBracket.length; i++) {
      const ch = afterBracket[i];

      // Skip strings (don't count braces inside strings)
      if (ch === '"') {
        i++;
        while (i < afterBracket.length && afterBracket[i] !== '"') {
          if (afterBracket[i] === '\\') i++; // skip escaped char
          i++;
        }
        continue;
      }

      if (ch === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart >= 0) {
          // Complete object found
          const objStr = afterBracket.slice(objStart, i + 1);
          try {
            const parsed = JSON.parse(objStr);
            if (parsed.name && parsed.description != null) {
              items.push({
                name: parsed.name,
                description: parsed.description,
                required: parsed.required ?? true,
                source: parsed.source,
                confidence: parsed.confidence || "high",
                uploadable: parsed.uploadable,
              });
            }
          } catch (err) {
            // Incomplete or malformed — skip (expected during streaming)
            if (isDevelopment()) {
              console.warn("[Research] Failed to parse partial item:", err);
            }
          }
          objStart = -1;
        }
      } else if (ch === ']' && depth === 0) {
        // End of items array
        break;
      }
    }

    // Return only items beyond what we've already emitted
    return items.slice(alreadyEmitted);
  } catch (err) {
    // Parsing failed, return empty array (expected during early streaming)
    if (isDevelopment()) {
      console.warn("[Research] Failed to parse items array:", err);
    }
    return [];
  }
}

/**
 * Parses the LLM response into a RequirementsChecklist.
 * This is a simplified parser - in production you'd want more robust JSON extraction.
 */
function parseRequirementsFromText(
  text: string,
  travel: TravelDetails,
  corridor: string,
  requiredValidUntil: Date
): RequirementsChecklist {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as RequirementsChecklist;
    }
  } catch (e) {
    // JSON parsing failed, fall through to fallback
  }

  // Fallback if parsing fails
  return createFallbackRequirements(travel, corridor, requiredValidUntil);
}

/**
 * Creates a minimal fallback requirements object.
 */
function createFallbackRequirements(
  travel: TravelDetails,
  corridor: string,
  requiredValidUntil: Date
): RequirementsChecklist {
  return {
    corridor,
    visaType: "Unknown - Research Required",
    visaRequired: true,
    items: [
      {
        name: "Passport",
        description: "Valid passport",
        required: true,
        confidence: "high",
        personalizedDetail: `Passport must be valid until ${requiredValidUntil.toISOString().split("T")[0]}`,
      },
      {
        name: "Visa Application Form",
        description: "Completed visa application",
        required: true,
        confidence: "high",
      },
    ],
    fees: {
      visa: "To be determined",
    },
    processingTime: "Unknown",
    applyAt: "Embassy or consulate",
    importantNotes: [
      "Unable to retrieve complete requirements. Please verify with official sources.",
    ],
    sources: [],
  };
}

