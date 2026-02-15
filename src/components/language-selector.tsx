"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown, Loader2, Search } from "lucide-react";

// ============================================================
// Language definitions
// ============================================================

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "tl", name: "Filipino", nativeName: "Filipino" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá" },
  { code: "ig", name: "Igbo", nativeName: "Igbo" },
  { code: "zu", name: "Zulu", nativeName: "isiZulu" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "ro", name: "Romanian", nativeName: "Română" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά" },
  { code: "he", name: "Hebrew", nativeName: "עברית" },
  { code: "fa", name: "Persian", nativeName: "فارسی" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල" },
  { code: "my", name: "Burmese", nativeName: "မြန်မာ" },
  { code: "km", name: "Khmer", nativeName: "ខ្មែរ" },
];

// ============================================================
// Country → language code mapping (for corridor-aware suggestions)
// Maps country names to LANGUAGES codes spoken there.
// ============================================================

const COUNTRY_LANGUAGES: Record<string, string[]> = {
  // Americas
  "Argentina": ["es"], "Bahamas": ["en"], "Barbados": ["en"], "Belize": ["en", "es"],
  "Bolivia": ["es"], "Brazil": ["pt"], "Canada": ["en", "fr"],
  "Chile": ["es"], "Colombia": ["es"], "Costa Rica": ["es"], "Cuba": ["es"],
  "Dominica": ["en"], "Dominican Republic": ["es"], "Ecuador": ["es"], "El Salvador": ["es"],
  "Grenada": ["en"], "Guatemala": ["es"], "Guyana": ["en"], "Haiti": ["fr"],
  "Honduras": ["es"], "Jamaica": ["en"], "Mexico": ["es"], "Nicaragua": ["es"],
  "Panama": ["es"], "Paraguay": ["es"], "Peru": ["es"], "Puerto Rico": ["es", "en"],
  "Saint Kitts and Nevis": ["en"], "Saint Lucia": ["en"],
  "Saint Vincent and the Grenadines": ["en"], "Suriname": ["nl"],
  "Trinidad and Tobago": ["en"], "United States": ["en"], "Uruguay": ["es"], "Venezuela": ["es"],
  // Europe
  "Andorra": ["es", "fr"], "Austria": ["de"], "Belarus": ["ru"],
  "Belgium": ["nl", "fr", "de"], "Bosnia and Herzegovina": ["tr"],
  "Bulgaria": ["bg"], "Croatia": ["hr"], "Cyprus": ["el", "tr"],
  "Czech Republic": ["cs"], "Denmark": ["da"], "Estonia": ["en"],
  "Finland": ["fi"], "France": ["fr"], "Germany": ["de"], "Greece": ["el"],
  "Hungary": ["hu"], "Iceland": ["is"], "Ireland": ["en"], "Italy": ["it"],
  "Kosovo": ["tr"], "Latvia": ["en"], "Liechtenstein": ["de"],
  "Lithuania": ["en"], "Luxembourg": ["fr", "de"],
  "Malta": ["en"], "Moldova": ["ro"], "Monaco": ["fr"], "Montenegro": ["sr"],
  "Netherlands": ["nl"], "North Macedonia": ["tr"], "Norway": ["no"],
  "Poland": ["pl"], "Portugal": ["pt"], "Romania": ["ro"], "Russia": ["ru"],
  "San Marino": ["it"], "Serbia": ["sr"], "Slovakia": ["sk"], "Slovenia": ["sl"],
  "Spain": ["es"], "Sweden": ["sv"], "Switzerland": ["de", "fr", "it"],
  "Ukraine": ["uk"], "United Kingdom": ["en"], "Vatican City": ["it"],
  // Middle East & North Africa
  "Algeria": ["ar", "fr"], "Bahrain": ["ar"], "Djibouti": ["fr", "ar"],
  "Egypt": ["ar"], "Eritrea": ["ar"], "Iran": ["fa"], "Iraq": ["ar"],
  "Israel": ["he", "ar"], "Jordan": ["ar"], "Kuwait": ["ar"], "Lebanon": ["ar", "fr"],
  "Libya": ["ar"], "Morocco": ["ar", "fr"], "Oman": ["ar"],
  "Palestine": ["ar"], "Qatar": ["ar"], "Saudi Arabia": ["ar"],
  "Syria": ["ar"], "Tunisia": ["ar", "fr"], "Turkey": ["tr"],
  "United Arab Emirates": ["ar", "en"], "Yemen": ["ar"],
  // Central Asia
  "Afghanistan": ["fa"], "Azerbaijan": ["tr"], "Kazakhstan": ["ru"],
  "Kyrgyzstan": ["ru"], "Tajikistan": ["fa"], "Turkmenistan": ["tr"], "Uzbekistan": ["ru"],
  // South Asia
  "Bangladesh": ["bn"], "Bhutan": ["hi"],
  "India": ["hi", "en", "ta", "te", "bn", "mr", "gu", "ur"],
  "Maldives": ["en"], "Nepal": ["ne"], "Pakistan": ["ur", "en"],
  "Sri Lanka": ["si", "ta"],
  // East & Southeast Asia
  "Brunei": ["ms"], "Cambodia": ["km"], "China": ["zh"], "Hong Kong": ["zh", "en"],
  "Indonesia": ["id"], "Japan": ["ja"], "Laos": ["th"],
  "Malaysia": ["ms", "en"], "Mongolia": ["ru"], "Myanmar": ["my"],
  "North Korea": ["ko"], "Philippines": ["tl", "en"], "Singapore": ["en", "zh", "ms"],
  "South Korea": ["ko"], "Taiwan": ["zh"], "Thailand": ["th"],
  "Timor-Leste": ["pt"], "Vietnam": ["vi"],
  // Oceania
  "Australia": ["en"], "Fiji": ["en", "hi"], "Kiribati": ["en"],
  "Marshall Islands": ["en"], "Micronesia": ["en"], "Nauru": ["en"],
  "New Zealand": ["en"], "Palau": ["en"], "Papua New Guinea": ["en"],
  "Samoa": ["en"], "Solomon Islands": ["en"], "Tonga": ["en"],
  "Tuvalu": ["en"], "Vanuatu": ["en", "fr"],
  // Africa
  "Angola": ["pt"], "Benin": ["fr"], "Botswana": ["en"],
  "Burkina Faso": ["fr"], "Burundi": ["fr"], "Cameroon": ["fr", "en"],
  "Cape Verde": ["pt"], "Central African Republic": ["fr"],
  "Chad": ["fr", "ar"], "Comoros": ["fr", "ar"], "Congo": ["fr"],
  "Democratic Republic of the Congo": ["fr"],
  "Equatorial Guinea": ["es", "fr"], "Eswatini": ["en"],
  "Ethiopia": ["am"], "Gabon": ["fr"], "Gambia": ["en"], "Ghana": ["en"],
  "Guinea": ["fr"], "Guinea-Bissau": ["pt"],
  "Kenya": ["sw", "en"], "Lesotho": ["en"], "Liberia": ["en"],
  "Madagascar": ["fr"], "Malawi": ["en"], "Mali": ["fr"],
  "Mauritania": ["ar", "fr"], "Mauritius": ["en", "fr"],
  "Mozambique": ["pt"], "Namibia": ["en"], "Niger": ["fr"],
  "Nigeria": ["en", "ha", "yo", "ig"], "Rwanda": ["fr", "en"],
  "Senegal": ["fr"], "Seychelles": ["en", "fr"],
  "Sierra Leone": ["en"], "Somalia": ["ar"], "South Africa": ["zu", "en"],
  "South Sudan": ["en", "ar"], "Sudan": ["ar", "en"],
  "Tanzania": ["sw", "en"], "Togo": ["fr"], "Uganda": ["en", "sw"],
  "Zambia": ["en"], "Zimbabwe": ["en"],
};

/**
 * Given passport countries and destination, returns language codes
 * relevant to the corridor (excluding English since it's always first).
 */
function getCorridorLanguageCodes(passports: string[], destination: string): string[] {
  const codes = new Set<string>();
  for (const country of [...passports, destination]) {
    const langs = COUNTRY_LANGUAGES[country];
    if (langs) {
      for (const code of langs) {
        if (code !== "en") codes.add(code);
      }
    }
  }
  return Array.from(codes);
}

// ============================================================
// Component
// ============================================================

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (languageName: string) => void;
  isTranslating: boolean;
  suggestedLanguage?: string;
  /** Passport country names from the travel corridor */
  passports?: string[];
  /** Destination country name */
  destination?: string;
}

export function LanguageSelector({
  currentLanguage,
  onLanguageChange,
  isTranslating,
  suggestedLanguage,
  passports,
  destination,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const currentLang = LANGUAGES.find((l) => l.name === currentLanguage) || LANGUAGES[0];

  // Filter and sort languages
  const filtered = LANGUAGES.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  // Build suggested list with specific order:
  // 1. Origin languages (from passports)
  // 2. Destination languages
  // 3. Demo persona preferred language (if different)
  const suggestedInOrder: Language[] = [];
  const addedCodes = new Set<string>();

  // Add origin languages first (from passports)
  if (passports) {
    for (const passport of passports) {
      const langs = COUNTRY_LANGUAGES[passport] || [];
      for (const code of langs) {
        if (code !== "en" && !addedCodes.has(code)) {
          const lang = LANGUAGES.find((l) => l.code === code);
          if (lang && filtered.includes(lang)) {
            suggestedInOrder.push(lang);
            addedCodes.add(code);
          }
        }
      }
    }
  }

  // Add destination languages second
  if (destination) {
    const langs = COUNTRY_LANGUAGES[destination] || [];
    for (const code of langs) {
      if (code !== "en" && !addedCodes.has(code)) {
        const lang = LANGUAGES.find((l) => l.code === code);
        if (lang && filtered.includes(lang)) {
          suggestedInOrder.push(lang);
          addedCodes.add(code);
        }
      }
    }
  }

  // Add demo persona preferred language if not already added
  if (suggestedLanguage && suggestedLanguage !== "English") {
    const lang = LANGUAGES.find((l) => l.name === suggestedLanguage);
    if (lang && filtered.includes(lang) && !addedCodes.has(lang.code)) {
      suggestedInOrder.push(lang);
      addedCodes.add(lang.code);
    }
  }

  const suggested = suggestedInOrder;
  const rest = filtered.filter((l) => !addedCodes.has(l.code));

  const handleSelect = (lang: Language) => {
    onLanguageChange(lang.name);
    setIsOpen(false);
    setQuery("");
  };

  const isNonEnglish = currentLanguage !== "English";

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      {/* "English" reset button — always visible when in a non-English language */}
      {isNonEnglish && !isTranslating && (
        <button
          type="button"
          onClick={() => onLanguageChange("English")}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-border bg-secondary/60 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Switch back to English"
        >
          <span className="text-xs">EN</span>
        </button>
      )}

      {/* Trigger button — always shows English language name */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isTranslating}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
          transition-all duration-200
          ${isNonEnglish
            ? "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/15"
            : "border-border bg-secondary/60 text-foreground hover:border-border hover:bg-secondary"
          }
          ${isTranslating ? "opacity-70 cursor-wait" : "cursor-pointer"}
        `}
      >
        {isTranslating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Globe className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {isTranslating ? "Translating..." : currentLang.name}
        </span>
        <span className="sm:hidden">
          {isTranslating ? "..." : currentLang.code.toUpperCase()}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown — anchored below trigger, right-aligned */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] max-h-96 rounded-xl border border-border bg-popover backdrop-blur-sm shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search languages..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-secondary/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Language list */}
          <div className="overflow-y-auto max-h-[calc(24rem-3.5rem)]">
            {/* Quick reset to English — pinned at top when in non-English mode */}
            {isNonEnglish && !query && (
              <>
                <button
                  type="button"
                  onClick={() => handleSelect(LANGUAGES[0])}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm bg-secondary/40 hover:bg-secondary transition-colors border-b border-border"
                >
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">English</span>
                  <span className="text-xs text-muted-foreground ml-auto">Default</span>
                </button>
              </>
            )}

            {/* Suggested section */}
            {suggested.length > 0 && !query && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-blue-400 uppercase tracking-wider bg-blue-500/5">
                  Suggested for this corridor
                </div>
                {suggested.map((lang) => (
                  <LanguageOption
                    key={lang.code}
                    lang={lang}
                    isSelected={currentLanguage === lang.name}
                    onSelect={handleSelect}
                    highlighted
                  />
                ))}
                <div className="h-px bg-secondary" />
              </>
            )}

            {/* All languages */}
            {!query && suggested.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                All languages
              </div>
            )}

            {rest.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No languages found
              </div>
            )}

            {rest.map((lang) => (
              <LanguageOption
                key={lang.code}
                lang={lang}
                isSelected={currentLanguage === lang.name}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Language Option Row
// ============================================================

function LanguageOption({
  lang,
  isSelected,
  onSelect,
  highlighted,
}: {
  lang: Language;
  isSelected: boolean;
  onSelect: (lang: Language) => void;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(lang)}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all text-sm
        ${isSelected
          ? "bg-blue-500/15 text-blue-700 dark:text-blue-100"
          : highlighted
            ? "bg-blue-500/5 text-foreground hover:bg-blue-500/10"
            : "text-foreground hover:bg-secondary"
        }
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{lang.name}</span>
          {lang.nativeName !== lang.name && (
            <span className="text-muted-foreground text-xs">{lang.nativeName}</span>
          )}
        </div>
      </div>
      {isSelected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
    </button>
  );
}
