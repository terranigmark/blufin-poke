import type { Metadata } from "next";
import { MenuTV } from "./MenuTV";

export const metadata: Metadata = { title: "Menú TV · Blufin Poke Co", robots: { index: false } };

export default function MenuTVPage() {
  return <MenuTV />;
}
