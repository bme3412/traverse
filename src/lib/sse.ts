/**
 * Server-side SSE utilities.
 * Used by API routes to stream events to the client.
 */

import { SSEEvent } from "./types";

/**
 * Creates a ReadableStream that emits SSE-formatted events.
 * Pass an async generator that yields SSEEvent objects.
 */
export function createSSEStream(
  generator: () => AsyncGenerator<SSEEvent, void, unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator()) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        // Signal completion
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const errorEvent: SSEEvent = {
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

/**
 * Creates a standard SSE Response from an async generator.
 */
export function sseResponse(
  generator: () => AsyncGenerator<SSEEvent, void, unknown>
): Response {
  const stream = createSSEStream(generator);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
