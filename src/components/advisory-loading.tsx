"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";

interface AdvisoryLoadingProps {
  isVisible: boolean;
}

/**
 * Centered viewport modal that appears during Phase 2 (lightweight LLM synthesis).
 * Overlays the page with a subtle backdrop while personalized refinements
 * are being generated (~8-12 seconds).
 */
export function AdvisoryLoading({ isVisible }: AdvisoryLoadingProps) {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300">
      {/* Backdrop — transparent, no blur so content remains visible */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Modal card */}
      <div className="relative rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 shadow-2xl px-8 py-6 max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative flex-shrink-0">
            <Sparkles className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            <Loader2
              className="absolute -top-2 -left-2 w-11 h-11 text-emerald-600/25 dark:text-emerald-400/25 animate-spin"
              style={{ animationDuration: "2s" }}
            />
          </div>
          <div>
            <p className="text-base font-semibold text-emerald-800 dark:text-emerald-300">
              {t("Personalizing your recommendations...")}
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              {t(
                "Refining guidance based on your documents — just a few more seconds"
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
