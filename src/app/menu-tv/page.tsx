import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/i18n";
import { MenuTV } from "./MenuTV";

export const metadata: Metadata = { title: "Menú TV · Blufin Poke Co", robots: { index: false } };

export default function MenuTVPage() {
  return (
    <LanguageProvider>
      <MenuTV />
    </LanguageProvider>
  );
}
