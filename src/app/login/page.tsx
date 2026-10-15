import type { Metadata } from "next";
import { LoginPage } from "./Editor";

export const metadata: Metadata = { title: "Entrar · Blufin Poke Co", robots: { index: false } };

export default function Page() {
  return <LoginPage />;
}
