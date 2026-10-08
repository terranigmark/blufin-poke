import { Header } from "@/components/Header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh" }}>
      <Header />
      {children}
    </div>
  );
}
