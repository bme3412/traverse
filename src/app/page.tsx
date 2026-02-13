"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TravelForm } from "@/components/travel-form";
import { TravelDetails } from "@/lib/types";
import { useDemoContext, fetchDemoDocument } from "@/lib/demo-context";

export default function Home() {
  const router = useRouter();
  const { pendingLoad, clearPending, setDemoDocuments } = useDemoContext();
  const [prefilledData, setPrefilledData] = useState<TravelDetails | null>(null);
  const [pendingDocs, setPendingDocs] = useState<{ name: string; language: string; image: string }[]>([]);

  useEffect(() => {
    if (pendingLoad) {
      setPrefilledData(pendingLoad.travelDetails);
      setPendingDocs(pendingLoad.documents);
      clearPending();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">Travel corridors</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="px-8 py-1">
            <p className="stat-number text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">100+</p>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">languages</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="px-8 py-1">
            <p className="stat-number text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">1.5B</p>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">visas / year</p>
          </div>
        </div>

        {/* 3. Value proposition */}
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          AI that reviews travel documents like an expert — for{" "}
          <span className="text-blue-400">every applicant</span>,{" "}
          <span className="text-purple-400">every corridor</span>,{" "}
          <span className="text-emerald-400">every language</span>.
        </p>

        {/* 4. Subtext */}
        <p className="mt-3 text-sm text-muted-foreground/70 max-w-xl mx-auto">
          Upload your documents in any language. Traverse&apos;s Research,
          Document Intelligence, and Advisory systems work together to catch
          the errors that cause preventable rejections.
        </p>
      </section>

      {/* ── Form ── */}
      <div className="relative rounded-lg p-px mb-8 border border-border bg-card">
        <div className="rounded-[calc(0.5rem-1px)] bg-card backdrop-blur-sm p-6 sm:p-8">
          <TravelForm onSubmit={handleTravelSubmit} isLoading={false} prefilledData={prefilledData} />
        </div>
      </div>
    </div>
  );
}
