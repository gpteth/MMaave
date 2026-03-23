"use client";

import { useEffect } from "react";
import { useWeb3, BSC_MAINNET_CHAIN_ID } from "@/contexts/Web3Context";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectButtonProps {
  fullWidth?: boolean;
}

export default function ConnectButton({ fullWidth }: ConnectButtonProps) {
  const { address, isConnected, isConnecting, chainId, connect, disconnect, switchToBscMainnet } = useWeb3();
  const { t } = useLanguage();

  // Auto-switch to BSC Mainnet (must be in useEffect, not render phase)
  useEffect(() => {
    if (isConnected && chainId !== BSC_MAINNET_CHAIN_ID) {
      switchToBscMainnet();
    }
  }, [isConnected, chainId, switchToBscMainnet]);

  if (isConnecting) {
    return (
      <Button disabled className={cn(fullWidth && "w-full")}>
        <Spinner />
        {t("common.connecting")}
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button onClick={connect} className={cn(fullWidth && "w-full")}>
        {t("common.connectWallet")}
      </Button>
    );
  }

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-card-border text-sm">
        <span className="w-2 h-2 rounded-full bg-success" />
        <span className="font-mono">{shortAddr}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={disconnect}
        className="h-8 w-8 text-muted hover:text-danger"
        title="Disconnect"
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
