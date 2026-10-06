import type { Metadata } from "next";
import { Ticket } from "./Ticket";

export const metadata: Metadata = { title: "Ticket de mesa · Blufin Poke Co", robots: { index: false } };

export default function OrdenPage() {
  return <Ticket />;
}
