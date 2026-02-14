"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";

interface AdvisoryLoadingProps {
  isVisible: boolean;
}

/**
 * Subtle inline indicator that appears during Phase 2 (lightweight LLM synthesis).
 * This is NOT a full-screen blocker — the user can still see and interact with
 * the progressive advisory content. It just signals that personalized refinements
 * are being generated (~8-12 seconds).
 */
export function AdvisoryLoading({ isVisible }: AdvisoryLoadingProps) {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <Loader2 className="absolute -top-1 -left-1 w-7 h-7 text-emerald-600/30 dark:text-emerald-400/30 animate-spin" style={{ animationDuration: '2s' }} />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {t("Personalizing your recommendations...")}
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">
              {t("Refining guidance based on your documents — just a few more seconds")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
