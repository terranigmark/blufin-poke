import type { Metadata } from "next";
import { Builder } from "./Builder";

export const metadata: Metadata = { title: "Arma tu poke · Blufin Poke Co" };

export default function BuildPage() {
  return <Builder />;
}
