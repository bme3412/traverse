"use client";

import { ReactNode } from "react";
import { DemoProvider } from "@/lib/demo-context";
import { PersonaSidebar } from "@/components/persona-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <PersonaSidebar />
      <ThemeToggle />
      {children}
    </DemoProvider>
  );
}
