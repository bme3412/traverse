/**
 * Centralized configuration for the application
 */

/**
 * AI Model Configuration
 * All agents use Claude Opus 4.6 with extended thinking for maximum capability
 */
export const AI_CONFIG = {
  /** Claude model to use for all agents */
  MODEL: (process.env.ANTHROPIC_MODEL || "claude-opus-4-6") as string,

  /** Advisory model (defaults to Opus 4.6, can be overridden for cost optimization) */
  ADVISORY_MODEL: (process.env.ADVISORY_MODEL || "claude-opus-4-6") as string,

  /** Thinking budget for adaptive thinking (all agents with extended thinking) */
  THINKING_BUDGET: 16000,

  /** Maximum tokens for research agent (reduced from 10000 to cut latency — trimmed schema) */
  RESEARCH_MAX_TOKENS: 6000,

  /** Maximum tokens for document reading */
  DOCUMENT_READ_MAX_TOKENS: 8000,

  /** Maximum tokens for document analysis */
  DOCUMENT_ANALYSIS_MAX_TOKENS: 24000,

  /** Maximum tokens for advisory agent */
  ADVISORY_MAX_TOKENS: 8000,
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

  /** Short delay (ms) for UI updates and transitions */
  SHORT_DELAY_MS: 300,

  /** Very short delay (ms) for rapid updates */
  VERY_SHORT_DELAY_MS: 120,

  /** Minimal delay (ms) for event loop breathing */
  MINIMAL_DELAY_MS: 50,

  /** Quarter second delay (ms) for status updates */
  QUARTER_SECOND_MS: 250,
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
