import { Header } from "@/components/Header";
import { LanguageProvider } from "@/lib/i18n";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div style={{ minHeight: "100dvh" }}>
        <Header />
        {children}
      </div>
    </LanguageProvider>
  );
}
