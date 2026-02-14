"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Plane, GripVertical, X } from "lucide-react";
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
}

const PERSONAS: DemoPersona[] = [
  {
    id: "priya",
    name: "Priya Sharma",
    origin: "India",
    destination: "Germany",
    need: "Attending a tech conference in Munich. First time applying for a Schengen visa — needs to make sure her documents are in order before submitting.",
    preferredLanguage: "Hindi",
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
      { name: "Bank Statement", language: "English", image: "/demo-docs/amara-03-bank-statement.png" },
      { name: "Academic Transcripts", language: "English", image: "/demo-docs/amara-04-transcripts.png" },
      { name: "Personal Statement", language: "English", image: "/demo-docs/amara-05-personal-statement.png" },
      { name: "IELTS Score Report", language: "English", image: "/demo-docs/amara-06-ielts-score.png" },
      { name: "TB Test Certificate", language: "English", image: "/demo-docs/amara-07-tb-test.png" },
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
    travelDetails: {
      passports: ["Brazil"],
      destination: "Japan",
      purpose: "tourism",
      dates: { depart: "2026-04-01", return: "2026-04-22" },
      travelers: 1,
    },
    documents: [
      { name: "Passport", language: "Portuguese", image: "/demo-docs/carlos-01-passport.png" },
      { name: "Bank Statement", language: "Portuguese", image: "/demo-docs/carlos-02-bank-statement.png" },
      { name: "Freelance Income Proof", language: "Portuguese", image: "/demo-docs/carlos-03-freelance-income.png" },
      { name: "Travel Itinerary", language: "English", image: "/demo-docs/carlos-04-itinerary.png" },
      { name: "Hotel Reservations", language: "English", image: "/demo-docs/carlos-05-hotel.png" },
      { name: "Return Flight", language: "English", image: "/demo-docs/carlos-06-flight.png" },
    ],
  },
];

// ============================================================
// Component
// ============================================================

export function PersonaSidebar() {
  const { loadDemo } = useDemoContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(PERSONAS[0].id);
  const [previewImage, setPreviewImage] = useState<{ name: string; src: string } | null>(null);
  const [docsExpanded, setDocsExpanded] = useState(false);

  const persona = PERSONAS.find((p) => p.id === selectedId) || PERSONAS[0];

  const handleLoad = () => {
    loadDemo({
      travelDetails: persona.travelDetails,
      documents: persona.documents,
      preferredLanguage: persona.preferredLanguage,
    });
    setIsOpen(false);
  };

  return (
    <>
      {/* Toggle tab */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1.5 px-2.5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-r-lg shadow-lg transition-all duration-200 ${
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
        className={`fixed left-0 top-0 h-full w-[22rem] bg-popover backdrop-blur-sm border-r border-border z-40 transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } overflow-y-auto`}
      >
        <div className="p-5 pt-[4.5rem]">
          {/* Persona tabs — pt accounts for sticky header (h-14 + spacing) */}
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

          {/* Persona header — large & readable */}
          <div className="mb-5 rounded-xl border border-border bg-background/60 p-4">
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
            <p className="text-sm leading-relaxed text-foreground">
              {persona.need}
            </p>
          </div>

          {/* Documents — collapsible */}
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

          {/* Load button */}
          <button
            type="button"
            onClick={handleLoad}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Load {persona.name.split(" ")[0]}&apos;s Profile
          </button>

          <p className="mt-3 text-[11px] text-muted-foreground text-center">
            All persona data is fictional.
          </p>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Document preview modal */}
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
    </>
  );
}

// ============================================================
// Helpers
// ============================================================

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
