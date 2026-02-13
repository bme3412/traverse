/**
 * Centralized configuration for the application
 */

/**
 * AI Model Configuration
 */
export const AI_CONFIG = {
  /** Claude model to use for all agents */
  MODEL: (process.env.ANTHROPIC_MODEL || "claude-opus-4-6") as string,

  /** Thinking budget for adaptive thinking */
  THINKING_BUDGET: 16000,

  /** Maximum tokens for research agent (reduced from 24000 to cut latency) */
  RESEARCH_MAX_TOKENS: 10000,

  /** Maximum tokens for document reading */
  DOCUMENT_READ_MAX_TOKENS: 8000,

  /** Maximum tokens for document analysis */
  DOCUMENT_ANALYSIS_MAX_TOKENS: 24000,
} as const;

/**
 * Streaming Configuration
 * Controls how agent thinking and output is streamed to the UI
 */
export const STREAMING_CONFIG = {
  /** Minimum interval (ms) between emitting thinking updates */
  EMIT_INTERVAL_MS: 400,

  /** Minimum new characters required before emitting */
  MIN_NEW_CHARS: 80,

  /** Interval (ms) for showing text generation progress */
  TEXT_PROGRESS_MS: 2000,

  /** Delay (ms) between progressive requirement displays */
  REQUIREMENT_DISPLAY_DELAY_MS: 700,

  /** Delay (ms) between document read events */
  DOCUMENT_READ_DELAY_MS: 500,
} as const;

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
  /** Directory for storing cached requirements */
  CACHE_DIR: "data/requirements-cache",

  /** Whether to use cached requirements when available */
  ENABLE_CACHE: true,
} as const;

/**
 * UI Configuration
 */
export const UI_CONFIG = {
  /** Interval (ms) for updating live elapsed time displays */
  TIME_UPDATE_INTERVAL_MS: 100,
} as const;
