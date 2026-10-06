import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { MenuView } from "./MenuView";

export const metadata: Metadata = { title: "Menú · Blufin Poke Co" };

export default function MenuPage() {
  return (
    <>
      <MenuView />
      <Footer />
    </>
  );
}
