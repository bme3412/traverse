"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { TravelForm } from "@/components/travel-form";
import { TravelDetails } from "@/lib/types";
import { useDemoContext, fetchDemoDocument } from "@/lib/demo-context";
import { validateTravelDetails } from "@/lib/validation";

// Barrier-breaking phrases — continuous cycle through diverse scripts
const BARRIER_PHRASES = [
  "No immigration lawyer. No English required.",                     // English
  "Sin abogado de inmigración. Sin inglés requerido.",               // Spanish
  "\u0628\u062F\u0648\u0646 \u0645\u062D\u0627\u0645\u064A \u0647\u062C\u0631\u0629. \u0644\u0627 \u062D\u0627\u062C\u0629 \u0644\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629.",  // Arabic
  "\u65E0\u9700\u79FB\u6C11\u5F8B\u5E08\u3002\u65E0\u9700\u82F1\u8BED\u3002",                                     // Chinese
  "\u0907\u092E\u093F\u0917\u094D\u0930\u0947\u0936\u0928 \u0935\u0915\u0940\u0932 \u0915\u0940 \u091C\u093C\u0930\u0942\u0930\u0924 \u0928\u0939\u0940\u0902\u0964 \u0905\u0902\u0917\u094D\u0930\u0947\u091C\u093C\u0940 \u091C\u093C\u0930\u0942\u0930\u0940 \u0928\u0939\u0940\u0902\u0964",       // Hindi
  "Pas d\u2019avocat. Aucun anglais requis.",                        // French
];

export default function Home() {
  const router = useRouter();
  const { pendingLoad, clearPending, setDemoDocuments } = useDemoContext();
  const [prefilledData, setPrefilledData] = useState<TravelDetails | null>(null);
  const [pendingDocs, setPendingDocs] = useState<{ name: string; language: string; image: string }[]>([]);

  // Use ref to track if we've processed this load to prevent loops
  const processedLoadRef = useRef(false);

  // ── Language-cycling animation for the barrier-breaking line ──
  // Continuously loops: EN → ES → AR → ZH → HI → FR → EN → …
  const [barrierIdx, setBarrierIdx] = useState(0);
  const [barrierFading, setBarrierFading] = useState(false);
  const barrierRef = useRef(0);

  useEffect(() => {
    const FADE = 300;   // ms — matches CSS duration-300
    const DWELL = 1800; // ms — time each language is visible
    const COUNT = BARRIER_PHRASES.length - 1; // last entry is duplicate of first

    // Initial hold before cycling starts
    const initialDelay = setTimeout(() => {
      // Start the continuous cycle
      const step = () => {
        setBarrierFading(true);
        fadeTimeout = setTimeout(() => {
          barrierRef.current = (barrierRef.current + 1) % COUNT;
          setBarrierIdx(barrierRef.current);
          setBarrierFading(false);
        }, FADE);
      };
      step();
      interval = setInterval(step, DWELL + FADE);
    }, 2800);

    let interval: ReturnType<typeof setInterval>;
    let fadeTimeout: ReturnType<typeof setTimeout>;

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
      clearTimeout(fadeTimeout);
    };
  }, []);

  useEffect(() => {
    if (pendingLoad && !processedLoadRef.current) {
      processedLoadRef.current = true;

      // Validate travel details before using them
      const validatedTravelDetails = validateTravelDetails(pendingLoad.travelDetails);
      if (validatedTravelDetails) {
        // Intentional synchronization of external context state with local component state
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefilledData(validatedTravelDetails);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPendingDocs(pendingLoad.documents);
      } else {
        console.error("[Home] Invalid travel details from demo context:", pendingLoad.travelDetails);
        // Don't prefill if validation fails - let user enter manually
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefilledData(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPendingDocs([]);
      }

      clearPending();

      // Reset flag after a short delay
      setTimeout(() => {
        processedLoadRef.current = false;
      }, 1000);
    }
  }, [pendingLoad, clearPending]);

  const handleTravelSubmit = async (travelDetails: TravelDetails) => {
    const docsWithImages = pendingDocs.filter((d) => d.image);
    if (docsWithImages.length > 0) {
      try {
        const fetched = await Promise.all(
          docsWithImages.map((doc, i) => fetchDemoDocument(doc, i))
        );
        setDemoDocuments(fetched);
      } catch {
        // Error handled silently - demo docs are optional
      }
    }

    const params = new URLSearchParams({
      passports: JSON.stringify(travelDetails.passports),
      destination: travelDetails.destination,
      purpose: travelDetails.purpose,
      depart: travelDetails.dates.depart,
      return: travelDetails.dates.return,
      travelers: travelDetails.travelers.toString(),
      event: travelDetails.event || "",
    });
    router.push(`/analyze?${params.toString()}`);
  };

  return (
    <>
      <div className="mx-auto max-w-5xl px-6">
      {/* ── Hero ── */}
      <section className="pt-8 pb-6 text-center">
        {/* 1. Problem statement */}
        <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight leading-[1.15] text-foreground max-w-3xl mx-auto">
          Every year, millions of visa applications are rejected for preventable errors.
        </h1>

        {/* 2. Stats bar */}
        <div className="mt-6 flex items-center justify-center gap-0">
          <div className="px-8 py-1">
            <p className="stat-number text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">37,830+</p>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">Corridors covered</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="px-8 py-1">
            <p className="stat-number text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">40+</p>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">Languages understood</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="px-8 py-1">
            <p className="stat-number text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">1.5B</p>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">visas / year</p>
          </div>
        </div>

        {/* 3. Value proposition — colored verbs convey the AI pipeline */}
        <p className="mt-7 text-lg sm:text-xl text-foreground/80 max-w-2xl mx-auto leading-relaxed">
          Traverse&apos;s AI{" "}
          <span className="font-semibold text-blue-600 dark:text-blue-400">researches your requirements</span>,{" "}
          <span className="font-semibold text-purple-600 dark:text-purple-400">reads every document</span>, and{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">tells you exactly what to fix</span>.
        </p>

        {/* 4. Barrier-breaking — bold claim + subtitle, with language cycle */}
        <div className="mt-5 max-w-lg mx-auto text-center">
          <p
            className={`text-sm sm:text-base font-semibold text-foreground transition-opacity duration-300 ease-in-out ${barrierFading ? "opacity-0" : "opacity-100"}`}
          >
            {BARRIER_PHRASES[barrierIdx]}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Upload in any language and get expert-level guidance in minutes.
          </p>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <div className="max-w-2xl mx-auto mb-6 px-4">
        <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
          Traverse provides informational guidance only and does not constitute legal advice.
          Visa requirements change frequently — always verify with the official embassy or consulate.
          Not affiliated with any government agency. All demo profiles are entirely fictional.
        </p>
      </div>

      {/* ── Form ── */}
      <div className="relative rounded-lg p-px mb-8 border border-border bg-card">
        <div className="rounded-[calc(0.5rem-1px)] bg-card backdrop-blur-sm p-6 sm:p-8">
          <TravelForm
            onSubmit={handleTravelSubmit}
            isLoading={false}
            prefilledData={prefilledData}
          />
        </div>
      </div>
    </div>
    </>
  );
}
