"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { formatUSDT, formatNumber, getErrorMessage } from "@/lib/utils";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useInvestment, type ParsedOrder } from "@/hooks/useInvestment";
import ConnectButton from "@/components/shared/ConnectButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export default function InvestPage() {
  const { address, isConnected } = useWeb3();
  const [investAmount, setInvestAmount] = useState(100);
  const [referrerAddress, setReferrerAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const [useIncomeBalance, setUseIncomeBalance] = useState(false);

  const {
    orders,
    isRegistered,
    usdtBalance,
    balance,
    minInvestment,
    capMultiplier,
    totalEarned,
    totalInvested,
    invest,
    investFromBalance,
    isApproving,
    isInvesting,
    isConfirming,
    isConfirmed,
  } = useInvestment(address);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref") || "";
    if (ref) {
      setReferrerAddress(ref);
      localStorage.setItem("rockplan-referrer", ref);
    } else {
      const stored = localStorage.getItem("rockplan-referrer") || "";
      if (stored) setReferrerAddress(stored);
    }
  }, []);

  const referralLink = useMemo(() => {
    if (!address || typeof window === "undefined") return "";
    return `${window.location.origin}/invest?ref=${address}`;
  }, [address]);

  const handleCopyReferral = useCallback(() => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralLink]);

  const adjustAmount = (delta: number) => {
    setInvestAmount((prev) => Math.max(100, prev + delta));
  };

  const handleInvest = async () => {
    if (investAmount < 100 || investAmount % 100 !== 0) return;
    setError(null);

    try {
      const ref = referrerAddress || "";
      if (useIncomeBalance) {
        await investFromBalance(investAmount, ref);
      } else {
        await invest(investAmount, ref);
      }
    } catch (err: unknown) {
      console.error("Invest error:", err);
      setError(getErrorMessage(err, "Transaction failed"));
    }
  };

  const isLoading = isApproving || isInvesting || isConfirming;
  const capMul = capMultiplier / 100;

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card glow className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">{t("common.connectWallet")}</h2>
          <p className="text-muted">{t("landing.connectPrompt")}</p>
          <div className="mt-4"><ConnectButton /></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
      <div className="animate-slide-up stagger-1">
        <h1 className="text-xl md:text-2xl font-bold mb-1">{t("invest.title")}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-muted">钱包余额: <span className="font-mono font-bold">${formatNumber(formatUSDT(usdtBalance))}</span></span>
          <span className="text-muted">收入余额: <span className="font-mono font-bold text-success">${formatNumber(formatUSDT(balance))}</span></span>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${!useIncomeBalance ? 'bg-accent text-white' : 'bg-background text-muted hover:text-foreground'}`}
            onClick={() => setUseIncomeBalance(false)}
          >
            钱包余额
          </button>
          <button
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${useIncomeBalance ? 'bg-accent text-white' : 'bg-background text-muted hover:text-foreground'}`}
            onClick={() => setUseIncomeBalance(true)}
          >
            收入余额
          </button>
        </div>
      </div>

      {isConfirmed && (
        <Card className="bg-success/10 border-success/30">
          <p className="text-success font-bold">Investment successful!</p>
        </Card>
      )}

      {error && (
        <Card className="bg-danger/10 border-danger/30">
          <p className="text-danger text-sm">{error}</p>
        </Card>
      )}

      {!isRegistered && address?.toLowerCase() !== "0x769ddc8b629a6d8158cd6b2f335ae33fe9544fbf" && (
        <Card glow className="border-accent/30 animate-slide-up stagger-2">
          <div className="text-center mb-4">
            <h2 className="text-lg md:text-xl font-bold mb-2">{t("gate.title")}</h2>
            <p className="text-muted text-sm">{t("gate.subtitle")}</p>
          </div>
          <div>
            <label className="block text-sm text-muted mb-2">{t("gate.referrerLabel")}</label>
            <Input
              type="text"
              className="font-mono text-sm"
              placeholder="0x..."
              value={referrerAddress}
              onChange={(e) => setReferrerAddress(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted mt-1">{t("gate.referrerHint")}</p>
          </div>
        </Card>
      )}

      <Card glow className="animate-slide-up stagger-3">
        <h2 className="text-lg font-bold mb-4">{t("invest.title")}</h2>

        <div className="mb-4">
          <label className="block text-sm text-muted mb-2">{t("invest.amount")}</label>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => adjustAmount(-100)}
              className="w-12 h-12 text-xl shrink-0"
              disabled={investAmount <= 100 || isLoading}
            >
              -
            </Button>
            <Input
              type="number"
              className="text-center text-xl font-bold"
              value={investAmount}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setInvestAmount(Math.max(0, val));
              }}
              min={100}
              step={100}
              disabled={isLoading}
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => adjustAmount(100)}
              className="w-12 h-12 text-xl shrink-0"
              disabled={isLoading}
            >
              +
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[500, 1000, 5000, 10000].map((preset) => (
              <Button
                key={preset}
                variant="secondary"
                size="sm"
                onClick={() => setInvestAmount(preset)}
                disabled={isLoading}
              >
                ${preset.toLocaleString()}
              </Button>
            ))}
          </div>
          {investAmount > 0 && investAmount % 100 !== 0 && (
            <p className="text-danger text-sm mt-1">{t("invest.min")}</p>
          )}
          {investAmount < 100 && investAmount > 0 && (
            <p className="text-danger text-sm mt-1">{t("invest.min")}</p>
          )}
        </div>

        <div className="bg-background rounded-lg p-4 mb-4">
          <h3 className="text-sm font-bold text-muted mb-3">{t("invest.summary")}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{t("invest.orderAmount")}</span>
              <span className="font-mono">${investAmount.toLocaleString()} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("invest.maxReturn")}</span>
              <span className="font-mono">${(investAmount * capMul).toLocaleString()} USDT</span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleInvest}
          className="w-full"
          disabled={investAmount < 100 || investAmount % 100 !== 0 || isLoading}
        >
          {isApproving ? (
            <><Spinner /> Approving USDT...</>
          ) : isInvesting ? (
            <><Spinner /> Investing...</>
          ) : isConfirming ? (
            <><Spinner /> Confirming...</>
          ) : (
            `${t("invest.investBtn")} $${investAmount.toLocaleString()} USDT`
          )}
        </Button>
        <p className="text-xs text-muted text-center mt-2">
          {t("invest.password")}
        </p>
      </Card>

      {/* Referral Link */}
      <Card className="animate-slide-up stagger-4">
        <h2 className="text-base md:text-lg font-bold mb-3">{t("invest.referralLink")}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            className="font-mono text-xs"
            value={referralLink}
            readOnly
          />
          <Button
            onClick={handleCopyReferral}
            className={`whitespace-nowrap shrink-0 text-sm ${copied ? "!bg-success" : ""}`}
          >
            {copied ? t("invest.copied") : t("invest.copyLink")}
          </Button>
        </div>
        <p className="text-xs text-muted mt-2">{t("team.shareLink")}</p>
      </Card>

      {/* Current Orders */}
      <Card className="animate-slide-up stagger-5">
        <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4">{t("invest.myOrders")}</h2>
        {/* Mobile */}
        <div className="sm:hidden space-y-3">
          {orders.map((order: ParsedOrder) => {
            const pct = order.capLimit > 0n
              ? Number((order.totalReturned * 10000n) / order.capLimit) / 100
              : 0;
            const dateStr = new Date(order.createdAt * 1000).toLocaleDateString();
            return (
              <div key={order.id} className="bg-background rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted text-xs">#{order.id} · {dateStr}</span>
                  <Badge variant={order.isActive ? "success" : "warning"}>
                    {order.isActive ? t("common.active") : "Capped"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t("invest.orderAmount")}</span>
                  <span className="font-mono font-bold">${formatNumber(formatUSDT(order.amount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t("invest.orderEarned")}</span>
                  <span className="text-success font-mono">${formatNumber(formatUSDT(order.totalReturned))}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{t("dashboard.capProgress")}</span>
                    <span className="text-muted">{pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              </div>
            );
          })}
        </div>
        {/* Desktop */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-card-border">
                <TableHead>#</TableHead>
                <TableHead>{t("invest.orderAmount")}</TableHead>
                <TableHead>{t("invest.orderCreated")}</TableHead>
                <TableHead>{t("invest.orderEarned")}</TableHead>
                <TableHead>{t("dashboard.capProgress")}</TableHead>
                <TableHead>{t("wallet.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: ParsedOrder) => {
                const pct = order.capLimit > 0n
                  ? Number((order.totalReturned * 10000n) / order.capLimit) / 100
                  : 0;
                const dateStr = new Date(order.createdAt * 1000).toLocaleDateString();
                return (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell className="font-mono">${formatNumber(formatUSDT(order.amount))}</TableCell>
                    <TableCell className="text-muted">{dateStr}</TableCell>
                    <TableCell className="text-success font-mono">${formatNumber(formatUSDT(order.totalReturned))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="flex-1 min-w-[80px] h-2" />
                        <span className="text-xs text-muted whitespace-nowrap">{pct.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.isActive ? "success" : "warning"}>
                        {order.isActive ? t("common.active") : "Capped"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {orders.length === 0 && (
          <p className="text-center text-muted py-8">{t("invest.noOrders")}</p>
        )}

        {orders.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-card-border">
            <div className="bg-background rounded-lg p-3">
              <p className="text-muted text-xs mb-1">{t("dashboard.totalEarned")}</p>
              <p className="text-lg font-bold text-success">${formatNumber(formatUSDT(totalEarned))}</p>
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-muted text-xs mb-1">{t("dashboard.totalInvested")}</p>
              <p className="text-lg font-bold">${formatNumber(formatUSDT(totalInvested))}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
