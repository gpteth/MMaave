"use client";

import ConnectButton from "@/components/shared/ConnectButton";
import { useWeb3 } from "@/contexts/Web3Context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function Home() {
  const { isConnected } = useWeb3();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-2 hero-gradient animate-fade-in">
      {/* Hero Title */}
      <div className="mb-8 md:mb-10">
        <div className="inline-block mb-4 md:mb-5 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-accent text-xs md:text-sm font-medium">
          DeFi Investment Platform
        </div>
        <h1 className="text-4xl md:text-6xl font-bold mb-4 md:mb-5 leading-tight">
          <span className="bg-gradient-to-r from-accent via-accent-light to-warning bg-clip-text text-transparent">
            {t("landing.title")}
          </span>
        </h1>
        <p className="text-base md:text-xl text-muted max-w-lg mx-auto leading-relaxed">
          {t("landing.subtitle")}
        </p>
      </div>

      {/* Main Connect Card */}
      <div className="card-gradient glow-accent !p-6 md:!p-8 max-w-md w-full">
        <h2 className="text-lg font-semibold mb-2">{t("landing.getStarted")}</h2>
        <p className="text-sm text-muted mb-5 md:mb-6">
          {t("landing.connectPrompt")}
        </p>

        <div className="flex justify-center">
          <ConnectButton />
        </div>

        <div className="mt-6 md:mt-8 pt-5 md:pt-6 border-t border-card-border grid grid-cols-3 gap-3 md:gap-4 text-center">
          <div className="relative">
            <div className="text-2xl md:text-3xl font-bold text-accent">1%</div>
            <div className="text-[10px] md:text-xs text-muted mt-1.5">{t("landing.dailyReturn")}</div>
          </div>
          <div className="relative border-x border-card-border">
            <div className="text-2xl md:text-3xl font-bold text-success">2.5x</div>
            <div className="text-[10px] md:text-xs text-muted mt-1.5">{t("landing.maxReturn")}</div>
          </div>
          <div className="relative">
            <div className="text-2xl md:text-3xl font-bold text-warning">V7</div>
            <div className="text-[10px] md:text-xs text-muted mt-1.5">{t("landing.teamLevels")}</div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-3xl w-full">
        <div className="card card-hover group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2 text-foreground">{t("landing.staticIncome")}</h3>
          <p className="text-sm text-muted leading-relaxed">
            {t("landing.staticDesc")}
          </p>
        </div>
        <div className="card card-hover group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-success/10 flex items-center justify-center mb-3 group-hover:bg-success/20 transition-colors">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2 text-foreground">{t("landing.dynamicBonus")}</h3>
          <p className="text-sm text-muted leading-relaxed">
            {t("landing.dynamicDesc")}
          </p>
        </div>
        <div className="card card-hover group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-warning/10 flex items-center justify-center mb-3 group-hover:bg-warning/20 transition-colors">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2 text-foreground">{t("landing.aavePowered")}</h3>
          <p className="text-sm text-muted leading-relaxed">
            {t("landing.aaveDesc")}
          </p>
        </div>
      </div>
    </div>
  );
}
