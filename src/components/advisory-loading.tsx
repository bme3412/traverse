"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";

interface AdvisoryLoadingProps {
  isVisible: boolean;
}

/**
 * Loading banner that appears while Advisory Agent is thinking.
 * Shows between document analysis completion and advisory modal opening.
 */
export function AdvisoryLoading({ isVisible }: AdvisoryLoadingProps) {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative max-w-md mx-4">
        {/* Main card */}
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-emerald-200 dark:border-emerald-900">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 dark:from-emerald-950/20 dark:via-blue-950/20 dark:to-purple-950/20 opacity-60" />

          {/* Content */}
          <div className="relative p-8 text-center space-y-4">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <Sparkles className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-emerald-600/30 dark:text-emerald-400/30 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                {t("Preparing Your Recommendations")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("Our advisory agent is reviewing your application and crafting personalized guidance...")}
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 pt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
