import type { Metadata } from "next";
import { Editor } from "./Editor";

export const metadata: Metadata = { title: "Editor del menú · Blufin Poke Co", robots: { index: false } };

export default function LoginPage() {
  return <Editor />;
}
