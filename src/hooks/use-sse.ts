"use client";

import { useState, useCallback, useRef } from "react";
import { SSEEvent, AgentStatus, AnalysisResult } from "@/lib/types";

interface UseSSEOptions {
  url: string;
}

interface UseSSEReturn {
  events: SSEEvent[];
  isStreaming: boolean;
  error: string | null;
  agentStatuses: Record<string, AgentStatus>;
  agentStartTimes: Record<string, number>;
  result: AnalysisResult | null;
  start: (body: Record<string, unknown>) => void;
  reset: () => void;
  appendEvent: (event: SSEEvent) => void;
  setAgentStatus: (agent: string, status: AgentStatus) => void;
}

/**
 * Normalize long agent names from the server to short UI keys.
 * "Research Agent" -> "research"
 * "Document Agent (Reading)" | "Document Agent (Analysis)" -> "document"
 * "Advisory Agent" -> "advisory"
 */
function normalizeAgentName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("research")) return "research";
  if (lower.includes("document")) return "document";
  if (lower.includes("advisory")) return "advisory";
  return lower;
}

/**
 * Custom hook that consumes an SSE stream from a POST endpoint.
 * Parses SSE events and maintains agent status tracking.
 */
export function useSSE({ url }: UseSSEOptions): UseSSEReturn {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentStartTimes, setAgentStartTimes] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setEvents([]);
    setIsStreaming(false);
    setError(null);
    setAgentStatuses({});
    setAgentStartTimes({});
    setResult(null);
  }, []);

  const appendEvent = useCallback((event: SSEEvent) => {
    setEvents((prev) => [...prev, event]);

    // Track agent statuses
    if (event.type === "orchestrator" && event.agent) {
      const key = normalizeAgentName(event.agent);
      if (event.action === "agent_start") {
        setAgentStatuses((prev) => ({ ...prev, [key]: "active" }));
        setAgentStartTimes((prev) => ({ ...prev, [key]: Date.now() }));
      } else if (event.action === "agent_complete") {
        setAgentStatuses((prev) => ({ ...prev, [key]: "complete" }));
      }
    }
  }, []);

  const setAgentStatusFn = useCallback((agent: string, status: AgentStatus) => {
    setAgentStatuses((prev) => ({ ...prev, [agent]: status }));
  }, []);

  const start = useCallback(
    (body: Record<string, unknown>) => {
      // Reset state
      reset();
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          if (!response.body) {
            throw new Error("No response body");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE lines from buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              const trimmed = line.trim();

              if (!trimmed || trimmed.startsWith(":")) continue; // Skip empty/comment lines

              if (trimmed.startsWith("data: ")) {
                const data = trimmed.slice(6);

                if (data === "[DONE]") {
                  setIsStreaming(false);
                  return;
                }

                try {
                  const event: SSEEvent = JSON.parse(data);

                  // Append event
                  setEvents((prev) => [...prev, event]);

                  // Track agent statuses (normalize names for UI lookup)
                  if (event.type === "orchestrator" && event.agent) {
                    const key = normalizeAgentName(event.agent);
                    if (event.action === "agent_start") {
                      setAgentStatuses((prev) => ({
                        ...prev,
                        [key]: "active",
                      }));
                      setAgentStartTimes((prev) => ({
                        ...prev,
                        [key]: Date.now(),
                      }));
                    } else if (event.action === "agent_complete") {
                      setAgentStatuses((prev) => ({
                        ...prev,
                        [key]: "complete",
                      }));
                    }
                  }

                  // Handle completion
                  if (event.type === "complete") {
                    setResult(event.data);
                  }

                  // Handle errors
                  if (event.type === "error") {
                    setError(event.message);
                  }
                } catch {
                  // Skip malformed JSON
                  console.warn("Failed to parse SSE event:", data);
                }
              }
            }
          }

          setIsStreaming(false);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            // Intentional abort — don't set error
            return;
          }
          setError(err instanceof Error ? err.message : "Stream failed");
          setIsStreaming(false);
        }
      })();
    },
    [url, reset]
  );

  return { events, isStreaming, error, agentStatuses, agentStartTimes, result, start, reset, appendEvent, setAgentStatus: setAgentStatusFn };
}
