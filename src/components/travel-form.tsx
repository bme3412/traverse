"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TravelDetails, TravelPurpose } from "@/lib/types";
import countries from "@/data/countries.json";
import {
  Search,
  X,
  Briefcase,
  GraduationCap,
  Heart,
  Stethoscope,
  ArrowRight,
  Globe,
  Laptop,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Check,
} from "lucide-react";
import { countryFlag } from "@/lib/country-flags";

interface TravelFormProps {
  onSubmit: (details: TravelDetails) => void;
  isLoading?: boolean;
  prefilledData?: TravelDetails | null;
}

const PURPOSES: {
  value: TravelPurpose;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "tourism", label: "Tourism", icon: <MapPin className="w-3.5 h-3.5" /> },
  { value: "business", label: "Business", icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: "work", label: "Work", icon: <Globe className="w-3.5 h-3.5" /> },
  { value: "study", label: "Study", icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { value: "medical", label: "Medical", icon: <Stethoscope className="w-3.5 h-3.5" /> },
  { value: "family", label: "Family", icon: <Heart className="w-3.5 h-3.5" /> },
  { value: "digital_nomad", label: "Digital Nomad", icon: <Laptop className="w-3.5 h-3.5" /> },
];

// ============================================================
// Searchable Country Picker
// ============================================================

function CountryPicker({
  value,
  onChange,
  placeholder,
  error,
}: {
  value: string;
  onChange: (country: string) => void;
  placeholder: string;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? countries.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : countries;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % filtered.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightedIndex]) {
          onChange(filtered[highlightedIndex]);
          setQuery("");
          setIsOpen(false);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (country: string) => {
    onChange(country);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        {value && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl pointer-events-none">
            {countryFlag(value)}
          </span>
        )}
        {!value && (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value || query}
          onChange={(e) => {
            if (value) {
              onChange("");
            }
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value) {
              setQuery("");
            }
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full ${value ? "pl-12" : "pl-11"} pr-12 py-3 rounded-xl border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${
            error
              ? "border-red-500/60 bg-card"
              : value
                ? "border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10"
                : "border-border bg-card"
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear selection"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {isOpen && !value && (
        <div className="absolute z-50 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-popover backdrop-blur-sm shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No countries found</div>
          ) : (
            filtered.map((c, index) => (
              <button
                key={c}
                type="button"
                onClick={() => handleSelect(c)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all text-sm ${
                  index === highlightedIndex
                    ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                <span className="text-lg">{countryFlag(c)}</span>
                <span className="font-medium">{c}</span>
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ============================================================
// Main Form
// ============================================================

export function TravelForm({ onSubmit, isLoading = false, prefilledData }: TravelFormProps) {
  const [formData, setFormData] = useState<Partial<TravelDetails>>({
    passports: [],
    destination: "",
    purpose: "tourism",
    dates: { depart: "", return: "" },
    travelers: 1,
    event: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [animatedFields, setAnimatedFields] = useState<Set<string>>(new Set());
  const [pulseButton, setPulseButton] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Compute today's date string client-side only to avoid hydration mismatch
  const [todayStr, setTodayStr] = useState("");
  useEffect(() => {
    setTodayStr(new Date().toISOString().split("T")[0]);
  }, []);

  // Track if we've already animated this prefill to prevent re-triggering
  const lastPrefilledRef = useRef<TravelDetails | null>(null);

  useEffect(() => {
    if (prefilledData && prefilledData !== lastPrefilledRef.current) {
      lastPrefilledRef.current = prefilledData;

      // Update form data
      setFormData(prefilledData);
      setErrors({});

      // Trigger subtle animations
      setShowSpotlight(true);

      // Staggered field animation
      const fields = ["passports", "destination", "purpose", "dates", "event"];
      fields.forEach((field, index) => {
        setTimeout(() => {
          setAnimatedFields((prev) => new Set(prev).add(field));
        }, index * 100);
      });

      // Remove spotlight after animation
      setTimeout(() => {
        setShowSpotlight(false);
      }, 1500);

      // Guide user to next step
      setTimeout(() => {
        // Scroll to Check Requirements button
        if (submitButtonRef.current) {
          submitButtonRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }

        // Pulse the button to draw attention
        setPulseButton(true);

        // Stop pulsing after 6 seconds
        setTimeout(() => {
          setPulseButton(false);
        }, 6000);
      }, 600);
    }
  }, [prefilledData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.passports || formData.passports.length === 0)
      newErrors.passports = "Select at least one passport";
    if (!formData.destination) newErrors.destination = "Select a destination";
    if (!formData.dates?.depart) newErrors.depart = "Required";
    // Return date is optional (for relocations, one-way trips)
    if (formData.dates?.depart && formData.dates?.return) {
      if (new Date(formData.dates.return) <= new Date(formData.dates.depart))
        newErrors.return = "Must be after departure";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateRandomCorridor = () => {
    // Get two different random countries
    const randomPassport = countries[Math.floor(Math.random() * countries.length)];
    let randomDestination = countries[Math.floor(Math.random() * countries.length)];

    // Ensure destination is different from passport
    while (randomDestination === randomPassport) {
      randomDestination = countries[Math.floor(Math.random() * countries.length)];
    }

    // Random purpose
    const randomPurpose = PURPOSES[Math.floor(Math.random() * PURPOSES.length)].value;

    // Random departure date (between tomorrow and 6 months from now)
    const today = new Date();
    const minDays = 1;
    const maxDays = 180;
    const randomDepartDays = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
    const departDate = new Date(today);
    departDate.setDate(today.getDate() + randomDepartDays);

    // Random return date (between 3 and 30 days after departure)
    const minTripDays = 3;
    const maxTripDays = 30;
    const randomTripDays = Math.floor(Math.random() * (maxTripDays - minTripDays + 1)) + minTripDays;
    const returnDate = new Date(departDate);
    returnDate.setDate(departDate.getDate() + randomTripDays);

    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Set random form data
    setFormData({
      passports: [randomPassport],
      destination: randomDestination,
      purpose: randomPurpose,
      dates: {
        depart: formatDate(departDate),
        return: formatDate(returnDate),
      },
      travelers: 1,
      event: "",
    });

    // Clear any errors
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validate()) onSubmit(formData as TravelDetails);
  };

  const updateField = useCallback(
    (field: keyof TravelDetails, value: unknown) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (prev[field]) {
          const next = { ...prev };
          delete next[field];
          return next;
        }
        return prev;
      });
    },
    []
  );

  const passport = formData.passports?.[0] || "";
  const destination = formData.destination || "";

  // Layer 1+3: Derive completion state from actual form data (works for both manual + demo)
  const corridorComplete = !!(passport && destination);
  const datesComplete = !!formData.dates?.depart;
  const eventFilled = !!formData.event;
  const isFormReady = corridorComplete && datesComplete;

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className={`space-y-8 ${showSpotlight ? "animate-spotlight" : ""}`}
      >
      {/* ── Step 1: Corridor ── */}
      <div className={animatedFields.has("passports") || animatedFields.has("destination") ? "animate-field-slide" : ""} style={{ animationDelay: "0ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold uppercase tracking-wider transition-colors duration-300 ${
            corridorComplete ? "text-foreground" : "text-muted-foreground"
          }`}>
            Travel Corridor
          </h3>
          {corridorComplete && (
            <div className="transition-all duration-300 animate-in fade-in">
              <div className="bg-green-500/20 text-green-500 rounded-full p-1">
                <Check className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* From */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Passport held
            </label>
            <CountryPicker
              value={passport}
              onChange={(c) => updateField("passports", c ? [c] : [])}
              placeholder="Search country..."
              error={errors.passports}
            />
          </div>

          {/* Arrow — lights up when corridor is complete */}
          <div className="pt-5">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 ${
              corridorComplete
                ? "bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/15"
                : "bg-secondary border-border"
            }`}>
              <ArrowRight className={`w-4 h-4 transition-colors duration-300 ${
                corridorComplete ? "text-blue-500" : "text-muted-foreground"
              }`} />
            </div>
          </div>

          {/* To */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Destination
            </label>
            <CountryPicker
              value={destination}
              onChange={(c) => updateField("destination", c)}
              placeholder="Search country..."
              error={errors.destination}
            />
          </div>
        </div>
      </div>

      {/* ── Step 2: Purpose ── */}
      <div className={animatedFields.has("purpose") ? "animate-field-slide" : ""} style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Purpose of Travel
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => updateField("purpose", p.value)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                formData.purpose === p.value
                  ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-300"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Step 3: Dates ── */}
      <div className={animatedFields.has("dates") ? "animate-field-slide" : ""} style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-semibold uppercase tracking-wider transition-colors duration-300 ${
            datesComplete ? "text-foreground" : "text-muted-foreground"
          }`}>
            Travel Dates
          </h3>
          <div className="flex items-center gap-2">
            {formData.dates?.depart && formData.dates?.return && (
              <div className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {calculateDuration(formData.dates.depart, formData.dates.return)} days
              </div>
            )}
            {datesComplete && (
              <div className="transition-all duration-300 animate-in fade-in">
                <div className="bg-green-500/20 text-green-500 rounded-full p-1">
                  <Check className="w-3 h-3" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Departure
            </label>
            <input
              type="date"
              aria-label="Departure date"
              value={formData.dates?.depart || ""}
              min={todayStr}
              onChange={(e) =>
                updateField("dates", { ...formData.dates, depart: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-xl border text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${
                errors.depart
                  ? "border-red-500/60 bg-card"
                  : formData.dates?.depart
                    ? "border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10"
                    : "border-border bg-card"
              }`}
            />
            {errors.depart && <p className="mt-1.5 text-xs text-red-400">{errors.depart}</p>}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Return <span className="text-muted-foreground font-normal">(optional for relocation)</span>
            </label>
            <input
              type="date"
              aria-label="Return date"
              value={formData.dates?.return || ""}
              min={formData.dates?.depart || todayStr}
              onChange={(e) =>
                updateField("dates", { ...formData.dates, return: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-xl border text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${
                errors.return
                  ? "border-red-500/60 bg-card"
                  : formData.dates?.return
                    ? "border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10"
                    : "border-border bg-card"
              }`}
            />
            {errors.return && <p className="mt-1.5 text-xs text-red-400">{errors.return}</p>}
          </div>
        </div>
      </div>

      {/* ── Step 4: Event (optional) ── */}
      <div className={animatedFields.has("event") ? "animate-field-slide" : ""} style={{ animationDelay: "400ms" }}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-muted-foreground">
            Specific event <span className="text-muted-foreground">(optional)</span>
          </label>
          {eventFilled && (
            <div className="transition-all duration-300 animate-in fade-in">
              <div className="bg-green-500/20 text-green-500 rounded-full p-1">
                <Check className="w-3 h-3" />
              </div>
            </div>
          )}
        </div>
        <input
          type="text"
          value={formData.event || ""}
          onChange={(e) => updateField("event", e.target.value)}
          placeholder="e.g., Conference name, wedding, university..."
          className={`w-full px-4 py-3 rounded-xl border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${
            eventFilled
              ? "border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10"
              : "border-border bg-card"
          }`}
        />
      </div>

      {/* ── Submit ── */}
      <div className="flex items-center justify-between">
        {/* Random Corridor Button - Bottom Left */}
        <button
          type="button"
          onClick={generateRandomCorridor}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Random
        </button>

        {/* Check Requirements Button — transforms when form is ready */}
        <button
          ref={submitButtonRef}
          type="submit"
          disabled={isLoading}
          className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-300 text-sm ${
            isLoading
              ? "px-4 py-2 bg-muted text-muted-foreground cursor-not-allowed"
              : isFormReady
                ? "px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25"
                : "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white"
          } ${pulseButton && isFormReady ? "animate-pulse-glow" : ""}`}
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              Check Requirements
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function calculateDuration(depart: string, returnDate: string): number {
  const start = new Date(depart);
  const end = new Date(returnDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
