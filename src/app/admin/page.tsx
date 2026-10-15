import type { Metadata } from "next";
import { AdminPage } from "../login/Editor";

export const metadata: Metadata = { title: "Editor del menú · Blufin Poke Co", robots: { index: false } };

export default function Page() {
  return <AdminPage />;
}
