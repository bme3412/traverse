"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { TravelDetails, UploadedDocument } from "./types";

interface DemoLoadPayload {
  travelDetails: TravelDetails;
  documents: { name: string; language: string; image: string }[];
  preferredLanguage?: string;
}

interface DemoContextValue {
  /** The most recently loaded demo payload (travel + docs). Consumed once by the page. */
  pendingLoad: DemoLoadPayload | null;
  /** Called by the persona sidebar to trigger a demo load. */
  loadDemo: (payload: DemoLoadPayload) => void;
  /** Called by the consuming page to clear the pending load after handling it. */
  clearPending: () => void;
  /** Pre-fetched demo documents ready for the upload zone. */
  demoDocuments: UploadedDocument[];
  setDemoDocuments: (docs: UploadedDocument[]) => void;
  /** Demo document metadata (name, language, image) for auto-upload feature */
  demoDocMetadata: Array<{ name: string; language: string; image: string }>;
  setDemoDocMetadata: (docs: Array<{ name: string; language: string; image: string }>) => void;
  /** Suggested output language from the loaded persona */
  suggestedLanguage: string | null;
  /** Whether the current session originates from a demo persona (not a custom corridor). */
  isDemoProfile: boolean;
  /** Resets demo state (isDemoProfile, demoDocuments, suggestedLanguage) for custom corridors. */
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [pendingLoad, setPendingLoad] = useState<DemoLoadPayload | null>(null);
  const [demoDocuments, setDemoDocuments] = useState<UploadedDocument[]>([]);
  const [demoDocMetadata, setDemoDocMetadata] = useState<Array<{ name: string; language: string; image: string }>>([]);
  const [suggestedLanguage, setSuggestedLanguage] = useState<string | null>(null);
  const [isDemoProfile, setIsDemoProfile] = useState(false);

  const loadDemo = useCallback((payload: DemoLoadPayload) => {
    setPendingLoad(payload);
    setIsDemoProfile(true);
    if (payload.preferredLanguage) {
      setSuggestedLanguage(payload.preferredLanguage);
    }
    // Store demo document metadata in context so it persists across navigation
    if (payload.documents && payload.documents.length > 0) {
      setDemoDocMetadata(payload.documents);
    }
  }, []);

  const clearPending = useCallback(() => {
    setPendingLoad(null);
  }, []);

  const resetDemo = useCallback(() => {
    setIsDemoProfile(false);
    setDemoDocuments([]);
    setDemoDocMetadata([]);
    setSuggestedLanguage(null);
  }, []);

  return (
    <DemoContext.Provider
      value={{ pendingLoad, loadDemo, clearPending, demoDocuments, setDemoDocuments, demoDocMetadata, setDemoDocMetadata, suggestedLanguage, isDemoProfile, resetDemo }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoContext must be used within DemoProvider");
  return ctx;
}

/**
 * Fetches a demo document image from /public, converts to base64 UploadedDocument.
 */
export async function fetchDemoDocument(
  doc: { name: string; language: string; image: string },
  index: number
): Promise<UploadedDocument> {
  const response = await fetch(doc.image);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  return {
    id: `demo-${index}-${Date.now()}`,
    filename: `${doc.name.toLowerCase().replace(/\s+/g, "-")}.png`,
    base64,
    mimeType: "image/png",
    sizeBytes: blob.size,
  };
}
