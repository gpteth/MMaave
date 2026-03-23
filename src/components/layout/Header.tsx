"use client";

import ConnectButton from "../shared/ConnectButton";
import BurnCounter from "../shared/BurnCounter";
import LanguageSwitcher from "../shared/LanguageSwitcher";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useWeb3 } from "@/contexts/Web3Context";

export default function Header() {
  const { t } = useLanguage();
  const { isConnected } = useWeb3();

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 h-14 md:h-16 bg-surface/80 backdrop-blur-md border-b border-card-border shadow-[0_10px_30px_rgba(0,0,0,0.22)] flex items-center justify-between px-3 md:px-6 z-30">
      <div className="flex items-center gap-2 md:gap-4">
        <span className="md:hidden text-lg font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
          Rockplan
        </span>
        <div className="hidden md:block">
          <BurnCounter />
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:block">
          <LanguageSwitcher />
        </div>
        {isConnected && (
          <>
            <div className="hidden md:flex items-center gap-2 text-sm text-muted">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              {t("header.bscMainnet")}
            </div>
            <ConnectButton />
          </>
        )}
      </div>
    </header>
  );
}
