import type { Metadata } from "next";
import { ResetPasswordPage } from "../Editor";

export const metadata: Metadata = { title: "Contraseña nueva · Blufin Poke Co", robots: { index: false } };

export default function Page() {
  return <ResetPasswordPage />;
}
