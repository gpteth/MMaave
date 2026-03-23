"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { locales } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border border-card-border">
      {locales.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            locale === l.code
              ? "bg-accent text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
