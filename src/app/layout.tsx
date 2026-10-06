import type { Metadata, Viewport } from "next";
import { Barlow, Bebas_Neue, Kaushan_Script } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const barlow = Barlow({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-barlow" });
const kaushan = Kaushan_Script({ weight: "400", subsets: ["latin"], variable: "--font-kaushan" });

export const metadata: Metadata = {
  title: "Blufin Poke Co · Poke & Baja Craft Beer · La Paz",
  description: "Poke bowls al momento y cerveza artesanal Black Marlin en La Paz, Baja California Sur.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F2EADB" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bebas.variable} ${barlow.variable} ${kaushan.variable}`}>
      <body>{children}</body>
    </html>
  );
}
