/**
 * Extended type definitions for Anthropic SDK
 * Covers experimental features like adaptive thinking that may not be in official SDK types
 */

import type {
  MessageStream,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";

declare module "@anthropic-ai/sdk" {
  export interface MessageCreateParamsBase {
    /**
     * Experimental thinking configuration for extended reasoning
     */
    thinking?: {
      type: "adaptive";
      budget_tokens?: number;
    };
  }
}

/**
 * Extended content block types that include thinking blocks
 */
export type ExtendedContentBlock = ContentBlock | ThinkingBlock;

/**
 * Thinking block returned during adaptive thinking
 */
export interface ThinkingBlock {
  type: "thinking";
  thinking?: string;
}

/**
 * Text delta event during streaming
 */
export interface TextDelta {
  type: "text_delta";
  text: string;
  delta?: {
    type: "text_delta";
    text: string;
  };
}

/**
 * Thinking delta event during streaming
 */
export interface ThinkingDelta {
  type: "thinking_delta";
  thinking?: string;
  delta?: {
    type: "thinking_delta";
    thinking: string;
  };
}

/**
 * Content block start event
 */
export interface ContentBlockStart {
  type: "content_block_start";
  index: number;
  content_block: ExtendedContentBlock;
}

/**
 * Content block delta event
 */
export interface ContentBlockDelta {
  type: "content_block_delta";
  index: number;
  delta: TextDelta | ThinkingDelta;
}

/**
 * Content block stop event
 */
export interface ContentBlockStop {
  type: "content_block_stop";
  index: number;
}

/**
 * Message start event
 */
export interface MessageStart {
  type: "message_start";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    content: ExtendedContentBlock[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

/**
 * Message delta event
 */
export interface MessageDelta {
  type: "message_delta";
  delta: {
    stop_reason?: string;
    stop_sequence?: string | null;
  };
  usage?: {
    output_tokens: number;
  };
}

/**
 * Message stop event
 */
export interface MessageStop {
  type: "message_stop";
}

/**
 * Union type for all possible stream events
 */
export type StreamEvent =
  | MessageStart
  | ContentBlockStart
  | ContentBlockDelta
  | ContentBlockStop
  | MessageDelta
  | MessageStop;

/**
 * Helper type guard to check if a block is a text block
 */
export function isTextBlock(block: ExtendedContentBlock): block is TextBlock {
  return block.type === "text";
}

/**
 * Helper type guard to check if a block is a thinking block
 */
export function isThinkingBlock(
  block: ExtendedContentBlock
): block is ThinkingBlock {
  return block.type === "thinking";
}

/**
 * Helper type guard to check if a block is a tool use block
 */
export function isToolUseBlock(
  block: ExtendedContentBlock
): block is ToolUseBlock {
  return block.type === "tool_use";
}

/**
 * Helper type guard for text delta
 */
export function isTextDelta(
  delta: TextDelta | ThinkingDelta
): delta is TextDelta {
  return delta.type === "text_delta";
}

/**
 * Helper type guard for thinking delta
 */
export function isThinkingDelta(
  delta: TextDelta | ThinkingDelta
): delta is ThinkingDelta {
  return delta.type === "thinking_delta";
}
