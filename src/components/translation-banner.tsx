"use client";

import { Languages, Check, Loader2 } from "lucide-react";

interface TranslationBannerProps {
  targetLanguage: string;
  phase: "ui" | "requirements" | "content" | "complete" | null;
  isVisible: boolean;
}

// Bilingual phase labels: English / Target Language
const PHASE_LABELS: Record<string, Record<string, string>> = {
  ui: {
    English: "Translating interface...",
    Spanish: "Translating interface... / Traduciendo interfaz...",
    French: "Translating interface... / Traduction de l'interface...",
    German: "Translating interface... / Schnittstelle übersetzen...",
    Portuguese: "Translating interface... / Traduzindo interface...",
    Italian: "Translating interface... / Traduzione dell'interfaccia...",
    Russian: "Translating interface... / Перевод интерфейса...",
    Chinese: "Translating interface... / 翻译界面...",
    Japanese: "Translating interface... / インターフェースを翻訳中...",
    Korean: "Translating interface... / 인터페이스 번역 중...",
    Arabic: "Translating interface... / ترجمة الواجهة...",
    Hindi: "Translating interface... / इंटरफ़ेस का अनुवाद...",
  },
  requirements: {
    English: "Translating requirements...",
    Spanish: "Translating requirements... / Traduciendo requisitos...",
    French: "Translating requirements... / Traduction des exigences...",
    German: "Translating requirements... / Anforderungen übersetzen...",
    Portuguese: "Translating requirements... / Traduzindo requisitos...",
    Italian: "Translating requirements... / Traduzione dei requisiti...",
    Russian: "Translating requirements... / Перевод требований...",
    Chinese: "Translating requirements... / 翻译要求...",
    Japanese: "Translating requirements... / 要件を翻訳中...",
    Korean: "Translating requirements... / 요구사항 번역 중...",
    Arabic: "Translating requirements... / ترجمة المتطلبات...",
    Hindi: "Translating requirements... / आवश्यकताओं का अनुवाद...",
  },
  content: {
    English: "Translating content...",
    Spanish: "Translating content... / Traduciendo contenido...",
    French: "Translating content... / Traduction du contenu...",
    German: "Translating content... / Inhalt übersetzen...",
    Portuguese: "Translating content... / Traduzindo conteúdo...",
    Italian: "Translating content... / Traduzione del contenuto...",
    Russian: "Translating content... / Перевод контента...",
    Chinese: "Translating content... / 翻译内容...",
    Japanese: "Translating content... / コンテンツを翻訳中...",
    Korean: "Translating content... / 콘텐츠 번역 중...",
    Arabic: "Translating content... / ترجمة المحتوى...",
    Hindi: "Translating content... / सामग्री का अनुवाद...",
  },
  complete: {
    English: "Translation complete",
    Spanish: "Translation complete / Traducción completa",
    French: "Translation complete / Traduction terminée",
    German: "Translation complete / Übersetzung abgeschlossen",
    Portuguese: "Translation complete / Tradução completa",
    Italian: "Translation complete / Traduzione completata",
    Russian: "Translation complete / Перевод завершен",
    Chinese: "Translation complete / 翻译完成",
    Japanese: "Translation complete / 翻訳完了",
    Korean: "Translation complete / 번역 완료",
    Arabic: "Translation complete / اكتملت الترجمة",
    Hindi: "Translation complete / अनुवाद पूर्ण",
  },
};

export function TranslationBanner({ targetLanguage, phase, isVisible }: TranslationBannerProps) {
  if (!isVisible || !phase) return null;

  const isComplete = phase === "complete";

  // Get bilingual label for current phase
  const phaseLabel =
    PHASE_LABELS[phase]?.[targetLanguage] || PHASE_LABELS[phase]?.["English"] || "Translating...";

  return (
    <div
      className={`w-full border-b-2 transition-all duration-300 shadow-lg ${
        isComplete
          ? "bg-gradient-to-r from-green-600 to-emerald-600 border-green-700"
          : "bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-700"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 text-white">
            {isComplete ? (
              <Check className="w-5 h-5" strokeWidth={3} />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin" strokeWidth={3} />
            )}
          </div>

          {/* Main message - bilingual */}
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-white/80" />
            <span className="text-sm font-semibold text-white">
              {phaseLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
