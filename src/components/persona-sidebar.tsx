"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronLeft, Plane, GripVertical, X, CheckCircle2, FileText, ZoomIn } from "lucide-react";
import { TravelDetails } from "@/lib/types";
import { countryFlag } from "@/lib/country-flags";
import { useDemoContext } from "@/lib/demo-context";

// ============================================================
// Persona definitions
// ============================================================

interface DemoDocument {
  name: string;
  language: string;
  image: string; // Path in /public
}

interface DemoPersona {
  id: string;
  name: string;
  origin: string;
  destination: string;
  need: string; // What they need help with — no spoilers
  preferredLanguage: string; // The language this user would likely prefer
  travelDetails: TravelDetails;
  documents: DemoDocument[];
  // Rich contextual data
  occupation: string;
  previousTravel: string;
  visaHistory: string;
}

const PERSONAS: DemoPersona[] = [
  {
    id: "priya",
    name: "Priya Sharma",
    origin: "India",
    destination: "Germany",
    need: "Attending a tech conference in Munich. First time applying for a Schengen visa — needs to make sure her documents are in order before submitting.",
    preferredLanguage: "Hindi",
    occupation: "Senior Software Engineer at TechInnovate Solutions, Bangalore",
    previousTravel: "First time to Schengen area. Has visited Dubai (2024) and Singapore (2023) for work.",
    visaHistory: "US B1 visa (approved 2023), valid until 2033. No Schengen history.",
    travelDetails: {
      passports: ["India"],
      destination: "Germany",
      purpose: "business",
      dates: { depart: "2026-03-10", return: "2026-03-25" },
      travelers: 1,
      event: "European Software Architecture Summit 2026",
    },
    documents: [
      { name: "Valid Passport", language: "English", image: "/demo-docs/01-passport.png" },
      { name: "Business Invitation Letter", language: "English", image: "/demo-docs/05-conference-invitation-gmail.png" },
      { name: "Employment Proof", language: "Hindi", image: "/demo-docs/03-employment-letter-hindi.png" },
      { name: "Bank Statements", language: "Hindi", image: "/demo-docs/02-bank-statement-hindi.png" },
      { name: "Income Tax Returns", language: "English", image: "/demo-docs/priya-08-tax-returns.png" },
      { name: "Travel Itinerary", language: "English", image: "/demo-docs/06-flight-booking.png" },
      { name: "Accommodation Proof", language: "English", image: "/demo-docs/07-hotel-booking.png" },
      { name: "Travel Insurance", language: "English", image: "/demo-docs/priya-09-travel-insurance.png" },
      { name: "Cover Letter", language: "English", image: "/demo-docs/04-cover-letter-english.png" },
    ],
  },
  {
    id: "amara",
    name: "Amara Okafor",
    origin: "Nigeria",
    destination: "United Kingdom",
    need: "Accepted to a London university for a Master's programme. Preparing her Tier 4 student visa application and wants to check everything before her appointment.",
    preferredLanguage: "Yoruba",
    occupation: "Recent Computer Science graduate from University of Lagos. Starting MSc program.",
    previousTravel: "Never traveled to Europe. Has visited Ghana and South Africa for family visits.",
    visaHistory: "No previous visa applications. First major international travel.",
    travelDetails: {
      passports: ["Nigeria"],
      destination: "United Kingdom",
      purpose: "study",
      dates: { depart: "2026-09-05", return: "2027-06-20" },
      travelers: 1,
      event: "MSc Computer Science, University of London",
    },
    documents: [
      { name: "Passport", language: "English", image: "/demo-docs/amara-01-passport.png" },
      { name: "CAS Letter", language: "English", image: "/demo-docs/amara-02-cas-letter.png" },
      { name: "IELTS Score Report", language: "English", image: "/demo-docs/amara-06-ielts-score.png" },
      { name: "Bank Statement", language: "English", image: "/demo-docs/amara-03-bank-statement.png" },
      { name: "Academic Transcripts", language: "English", image: "/demo-docs/amara-04-transcripts.png" },
      { name: "TB Test Certificate", language: "English", image: "/demo-docs/amara-07-tb-test.png" },
      { name: "Personal Statement", language: "English", image: "/demo-docs/amara-05-personal-statement.png" },
      { name: "Accommodation Offer", language: "English", image: "/demo-docs/amara-08-accommodation.png" },
    ],
  },
  {
    id: "carlos",
    name: "Carlos Mendes",
    origin: "Brazil",
    destination: "Japan",
    need: "Freelance photographer planning a 3-week trip through Japan. Needs a tourist visa and wants to make sure his Portuguese financial documents meet the requirements.",
    preferredLanguage: "Portuguese",
    occupation: "Freelance Travel Photographer based in São Paulo. Portfolio includes work for major travel magazines.",
    previousTravel: "Extensive travel: Argentina, Chile, Peru, Mexico (2023-2025). First time to Asia.",
    visaHistory: "Schengen visa (approved 2024, used for Spain/Portugal assignment). No Asian visa history.",
    travelDetails: {
      passports: ["Brazil"],
      destination: "Japan",
      purpose: "tourism",
      dates: { depart: "2026-04-01", return: "2026-04-22" },
      travelers: 1,
    },
    documents: [
      { name: "Passport", language: "Portuguese", image: "/demo-docs/carlos-01-passport.png" },
      { name: "Return Flight", language: "English", image: "/demo-docs/carlos-06-flight.png" },
      { name: "Hotel Reservations", language: "English", image: "/demo-docs/carlos-05-hotel.png" },
      { name: "Bank Statement", language: "Portuguese", image: "/demo-docs/carlos-02-bank-statement.png" },
      { name: "Freelance Income Proof", language: "Portuguese", image: "/demo-docs/carlos-03-freelance-income.png" },
      { name: "Travel Itinerary", language: "English", image: "/demo-docs/carlos-04-itinerary.png" },
    ],
  },
];

// ============================================================
// Component
// ============================================================

export function PersonaSidebar() {
  const pathname = usePathname();
  const { loadDemo, isDemoProfile, loadedPersonaName, sidebarExpandRequested, clearSidebarExpandRequest, sidebarOpen: contextSidebarOpen, setSidebarOpen } = useDemoContext();
  const [isOpen, setIsOpenLocal] = useState(false);

  // Wrap setIsOpen to sync with context so other components can respond
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenLocal(open);
    setSidebarOpen(open);
  }, [setSidebarOpen]);
  const [selectedId, setSelectedId] = useState<string>(PERSONAS[0].id);
  const [previewImage, setPreviewImage] = useState<{ name: string; src: string } | null>(null);
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [loadSuccess, setLoadSuccess] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [zoomedGalleryImage, setZoomedGalleryImage] = useState<{ name: string; src: string } | null>(null);

  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const sidebarPanelRef = useRef<HTMLDivElement>(null);

  const isAnalyzePage = pathname?.startsWith("/analyze");

  // Find the loaded persona by name (for analyze page mode)
  const loadedPersona = loadedPersonaName
    ? PERSONAS.find((p) => p.name === loadedPersonaName) || null
    : null;

  // On analyze page, use the loaded persona; on home page, use selected tab
  const persona = isAnalyzePage && loadedPersona
    ? loadedPersona
    : PERSONAS.find((p) => p.id === selectedId) || PERSONAS[0];

  // Auto-expand sidebar after 4 seconds on initial home page load
  useEffect(() => {
    if (hasAutoExpanded || isAnalyzePage) return;

    const timer = setTimeout(() => {
      setIsOpen(true);
      setHasAutoExpanded(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, [hasAutoExpanded, isAnalyzePage, setIsOpen]);

  // Scroll-triggered expand: open sidebar when the analyze page signals via context
  // Only expands for demo profiles (the requestSidebarExpand call is already gated on isDemoProfile)
  useEffect(() => {
    if (sidebarExpandRequested && !isOpen) {
      setIsOpen(true);
      clearSidebarExpandRequest();
    }
  }, [sidebarExpandRequested, isOpen, clearSidebarExpandRequest, setIsOpen]);

  // Scroll sidebar to top whenever it opens on the analyze page so persona name is visible
  useEffect(() => {
    if (isOpen && isAnalyzePage && isDemoProfile && sidebarPanelRef.current) {
      sidebarPanelRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [isOpen, isAnalyzePage, isDemoProfile]);

  // Sync local state when other components open/close the sidebar via context
  // (e.g., progressive-requirements reopens after 1st upload, closes after 2nd)
  useEffect(() => {
    if (contextSidebarOpen && !isOpen) {
      setIsOpenLocal(true);
    } else if (!contextSidebarOpen && isOpen) {
      setIsOpenLocal(false);
    }
  }, [contextSidebarOpen, isOpen]);

  const handleLoad = async () => {
    // Load the demo data
    loadDemo({
      travelDetails: persona.travelDetails,
      documents: persona.documents,
      preferredLanguage: persona.preferredLanguage,
      personaName: persona.name,
    });

    // Show success checkmark briefly
    setLoadSuccess(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Close sidebar smoothly
    setLoadSuccess(false);
    setIsOpen(false);
  };

  return (
    <>
      {/* Toggle tab */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1.5 px-2.5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-r-lg shadow-lg transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-[22rem]" : "translate-x-0"
        }`}
        aria-label="Toggle demo personas"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
        Demo
      </button>

      {/* Sidebar panel */}
      <div
        ref={sidebarPanelRef}
        className={`fixed left-0 top-0 h-full w-[22rem] bg-popover backdrop-blur-sm border-r border-border z-40 transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } overflow-y-auto`}
      >
        <div className="p-5 pt-[4.5rem]">
          {/* Persona tabs — only on home page (not analyze page) */}
          {!(isAnalyzePage && isDemoProfile) && (
            <div className="flex gap-1.5 mb-5 bg-background rounded-lg p-1 border border-border">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelectedId(p.id); setDocsExpanded(false); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm transition-colors ${
                    selectedId === p.id
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-base">{countryFlag(p.origin)}</span>
                  <span>{p.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Persona header — large & readable */}
          <div className="mb-5 rounded-xl border border-border bg-background/60 p-4">
            {/* Fictional profile badge */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Fictional Demo Profile
              </span>
            </div>
            {/* Name + corridor flags */}
            <h2 className="text-lg font-bold text-foreground mb-1">{persona.name}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <span className="text-xl">{countryFlag(persona.origin)}</span>
              <span>{persona.origin}</span>
              <Plane className="w-3 h-3 text-muted-foreground" />
              <span className="text-xl">{countryFlag(persona.destination)}</span>
              <span>{persona.destination}</span>
            </div>

            {/* Quick facts row */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-xs text-foreground capitalize">
                {persona.travelDetails.purpose}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">
                {formatDateRange(persona.travelDetails.dates)}
              </span>
            </div>

            {/* Need */}
            <p className="text-sm leading-relaxed text-foreground mb-3">
              {persona.need}
            </p>

            {/* Rich contextual information */}
            <div className="space-y-2 pt-3 border-t border-border/50">
              {/* Occupation */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-0.5">
                  Occupation
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {persona.occupation}
                </p>
              </div>

              {/* Previous Travel */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-0.5">
                  Travel History
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {persona.previousTravel}
                </p>
              </div>

              {/* Visa History */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-0.5">
                  Visa History
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {persona.visaHistory}
                </p>
              </div>

            </div>
          </div>

          {/* Documents — collapsible (home page only) */}
          {!(isAnalyzePage && isDemoProfile) && (
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setDocsExpanded(!docsExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary transition-colors"
              >
                <span className="text-sm font-medium text-foreground">
                  Documents
                  <span className="ml-1.5 text-muted-foreground">({persona.documents.length})</span>
                </span>
                <span className="flex items-center justify-center w-5 h-5 rounded bg-muted-foreground/20 text-foreground text-xs font-bold">
                  {docsExpanded ? "−" : "+"}
                </span>
              </button>

              {docsExpanded && (
                <div className="mt-2 -mx-3 px-3 overflow-x-auto">
                  <div className="flex gap-2 pb-2">
                    {persona.documents.map((doc, i) => (
                      <button
                        key={i}
                        type="button"
                        draggable={!!doc.image}
                        onDragStart={(e) => {
                          if (!doc.image) {
                            e.preventDefault();
                            return;
                          }
                          e.dataTransfer.setData(
                            "application/x-demo-doc",
                            JSON.stringify({ name: doc.name, language: doc.language, image: doc.image })
                          );
                          e.dataTransfer.effectAllowed = "copy";
                          // Close sidebar after a frame so drop targets become accessible
                          requestAnimationFrame(() => setIsOpen(false));
                        }}
                        onClick={() => {
                          if (doc.image) setPreviewImage({ name: doc.name, src: doc.image });
                        }}
                        disabled={!doc.image}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors flex-shrink-0 w-20 ${
                          doc.image
                            ? "border-border bg-background hover:border-border hover:bg-card cursor-grab active:cursor-grabbing"
                            : "border-border/50 bg-background/50 cursor-default opacity-50"
                        }`}
                        title={doc.image ? "Drag to a requirement or click to preview" : undefined}
                      >
                        {/* Thumbnail */}
                        {doc.image ? (
                          <div className="w-14 h-16 rounded bg-secondary overflow-hidden border border-border flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={doc.image}
                              alt={doc.name}
                              className="w-full h-full object-cover object-top pointer-events-none"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-16 rounded bg-secondary flex-shrink-0 border border-border flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground">N/A</span>
                          </div>
                        )}

                        <div className="w-full text-center">
                          <p className="text-[10px] text-foreground leading-tight line-clamp-2">{doc.name}</p>
                          <p className="text-[9px] mt-0.5">
                            {doc.language !== "English" && (
                              <span className="text-amber-500/70">{doc.language}</span>
                            )}
                            {doc.language === "English" && <span className="text-muted-foreground">{doc.language}</span>}
                          </p>
                        </div>

                        {doc.image && (
                          <GripVertical className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documents — always-expanded draggable list (analyze page) */}
          {isAnalyzePage && isDemoProfile && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Documents
                <span className="ml-1 normal-case tracking-normal font-normal">({persona.documents.length})</span>
              </p>
              <div className="space-y-2.5">
                {persona.documents.map((doc, i) => (
                  <div
                    key={i}
                    draggable={!!doc.image}
                    onDragStart={(e) => {
                      if (!doc.image) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData(
                        "application/x-demo-doc",
                        JSON.stringify({ name: doc.name, language: doc.language, image: doc.image })
                      );
                      e.dataTransfer.effectAllowed = "copy";
                      // Close sidebar during drag so drop targets are accessible
                      requestAnimationFrame(() => setIsOpen(false));
                    }}
                    onClick={() => {
                      if (doc.image) setPreviewImage({ name: doc.name, src: doc.image });
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                      doc.image
                        ? "border-border bg-background hover:bg-card cursor-grab active:cursor-grabbing"
                        : "border-border/50 bg-background/50 opacity-50"
                    }`}
                  >
                    {/* Thumbnail */}
                    {doc.image ? (
                      <div className="w-10 h-12 rounded bg-secondary overflow-hidden border border-border flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={doc.image}
                          alt={doc.name}
                          className="w-full h-full object-cover object-top pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-12 rounded bg-secondary flex-shrink-0 border border-border flex items-center justify-center">
                        <span className="text-[9px] text-muted-foreground">N/A</span>
                      </div>
                    )}

                    {/* Name + language flag */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <span className="text-xs">{languageFlag(doc.language)}</span>
                        {doc.language}
                      </span>
                    </div>

                    {/* Drag grip */}
                    {doc.image && (
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action button — switches between Load Profile (home) and View Documents (analyze) */}
          {isAnalyzePage && isDemoProfile ? (
            <button
              type="button"
              onClick={() => { setShowGallery(true); setIsOpen(false); }}
              className="w-full px-4 py-2.5 rounded-lg font-medium transition-all text-sm flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
            >
              <FileText className="w-4 h-4" />
              View Documents
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLoad}
              disabled={loadSuccess}
              className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-300 text-sm flex items-center justify-center gap-2 ${
                loadSuccess
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {loadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-checkmark" />
                  <span>Profile Loaded!</span>
                </>
              ) : (
                <>Load {persona.name.split(" ")[0]}&apos;s Profile</>
              )}
            </button>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            All persona data is fictional.
          </p>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/25 z-30 backdrop-blur-[1px] animate-in fade-in duration-[1400ms]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Document preview modal (single doc) */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-8"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[85vh] bg-card rounded-xl border border-border overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-foreground">
                {previewImage.name}
              </p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                aria-label="Close preview"
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Image */}
            <div className="overflow-auto max-h-[calc(85vh-3rem)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.src}
                alt={previewImage.name}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Document gallery modal (all docs, horizontal scroll) */}
      {showGallery && persona && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-8"
          onClick={() => setShowGallery(false)}
        >
          <div
            className="relative max-w-6xl w-full max-h-[90vh] bg-card rounded-xl border border-border overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  {persona.name.split(" ")[0]}&apos;s Documents
                  <span className="ml-1.5 text-muted-foreground font-normal">({persona.documents.length})</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGallery(false)}
                aria-label="Close gallery"
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Horizontal scroll gallery */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth">
              <div className="flex h-full px-6 py-5 gap-6" style={{ minWidth: "max-content" }}>
                {persona.documents.map((doc, i) => (
                  <div
                    key={i}
                    className="snap-center flex-shrink-0 flex flex-col rounded-xl border border-border bg-background shadow-sm overflow-hidden"
                    style={{ width: "min(380px, 78vw)" }}
                  >
                    {/* Card label header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-secondary/40">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-muted-foreground/15 text-[10px] font-bold text-muted-foreground flex-shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      </div>
                      <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground" title={doc.language}>
                        <span className="text-sm">{languageFlag(doc.language)}</span>
                        <span className="text-[10px]">{doc.language}</span>
                      </span>
                    </div>

                    {/* Document image with zoom button */}
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doc.image}
                        alt={doc.name}
                        className="w-full max-h-[65vh] object-contain bg-secondary/20"
                      />
                      <button
                        type="button"
                        onClick={() => setZoomedGalleryImage({ name: doc.name, src: doc.image })}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        Zoom
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll hint */}
            <div className="flex items-center justify-center gap-2 px-5 py-2.5 border-t border-border text-xs text-muted-foreground flex-shrink-0">
              <ChevronLeft className="w-3 h-3" />
              <span>Scroll to browse all documents</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}

      {/* Zoomed document view (from gallery) */}
      {zoomedGalleryImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setZoomedGalleryImage(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center">
            {/* Header bar */}
            <div className="w-full flex items-center justify-between px-4 py-2.5 mb-2">
              <p className="text-sm font-medium text-white/90">{zoomedGalleryImage.name}</p>
              <button
                type="button"
                onClick={() => setZoomedGalleryImage(null)}
                aria-label="Close zoom"
                className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Full-size scrollable image */}
            <div className="overflow-auto max-h-[calc(92vh-3rem)] rounded-lg" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedGalleryImage.src}
                alt={zoomedGalleryImage.name}
                className="w-full cursor-default"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Helpers
// ============================================================

/** Map document language names to a representative country flag. */
function languageFlag(language: string): string {
  const LANGUAGE_TO_COUNTRY: Record<string, string> = {
    English: "United States",
    Hindi: "India",
    Portuguese: "Brazil",
    Yoruba: "Nigeria",
    Spanish: "Spain",
    French: "France",
    German: "Germany",
    Arabic: "Saudi Arabia",
    Chinese: "China",
    Japanese: "Japan",
    Korean: "South Korea",
    Russian: "Russia",
    Turkish: "Turkey",
    Italian: "Italy",
    Dutch: "Netherlands",
    Thai: "Thailand",
    Vietnamese: "Vietnam",
    Swahili: "Kenya",
    Malay: "Malaysia",
    Indonesian: "Indonesia",
    Tagalog: "Philippines",
    Bengali: "Bangladesh",
    Urdu: "Pakistan",
    Persian: "Iran",
    Polish: "Poland",
    Ukrainian: "Ukraine",
    Romanian: "Romania",
    Greek: "Greece",
    Czech: "Czech Republic",
    Swedish: "Sweden",
    Norwegian: "Norway",
    Danish: "Denmark",
    Finnish: "Finland",
    Hungarian: "Hungary",
  };
  const country = LANGUAGE_TO_COUNTRY[language];
  return country ? countryFlag(country) : "🌍";
}

function formatDateRange(dates: { depart: string; return: string }): string {
  const d = new Date(dates.depart);
  const r = new Date(dates.return);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (d.getFullYear() === r.getFullYear()) {
    if (d.getMonth() === r.getMonth()) {
      return `${months[d.getMonth()]} ${d.getDate()}-${r.getDate()}, ${d.getFullYear()}`;
    }
    return `${months[d.getMonth()]} ${d.getDate()} - ${months[r.getMonth()]} ${r.getDate()}`;
  }
  return `${months[d.getMonth()]} ${d.getFullYear()} - ${months[r.getMonth()]} ${r.getFullYear()}`;
}
