"use client";

/**
 * Cognitive Depth Indicator — shows how hard the model is thinking.
 * Renders as a subtle inline bar that fills proportionally to token usage.
 * Only appears when tokens/budget are meaningful; otherwise returns null.
 */
export function CognitiveDepth({
  tokens,
  budget,
}: {
  tokens: number;
  budget: number;
}) {
  if (!tokens || !budget) return null;
  const ratio = Math.min(tokens / budget, 1);

  // Don't render for trivial amounts
  if (ratio < 0.05) return null;

  const color =
    ratio > 0.7
      ? "bg-amber-400/60"
      : ratio > 0.4
        ? "bg-blue-400/50"
        : "bg-muted-foreground/30";

  return (
    <span
      className="relative ml-2 inline-flex h-1 w-10 shrink-0 overflow-hidden rounded-full bg-foreground/[0.04]"
      title={`Thinking depth: ${Math.round(ratio * 100)}%`}
    >
      <span
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  );
}
