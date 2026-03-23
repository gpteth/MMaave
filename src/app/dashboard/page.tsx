"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { formatUSDT, shortenAddress, formatNumber, getErrorMessage } from "@/lib/utils";
import { formatUnits } from "ethers";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useInvestment, type ParsedOrder } from "@/hooks/useInvestment";
import { useWithdraw } from "@/hooks/useWithdraw";
import { useIncomeRecords } from "@/hooks/useIncomeRecords";
import { USDT_DECIMALS } from "@/lib/contracts";
import ConnectButton from "@/components/shared/ConnectButton";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { Wallet, Plus, Bookmark } from "lucide-react";

const BCK_DECIMALS = 18;

export default function DashboardPage() {
  const { address, isConnected } = useWeb3();
  const { t } = useLanguage();

  const {
    balance,
    totalInvested,
    totalEarned,
    capLimit,
    capRemaining,
    orders,
    usdtBalance,
    capMultiplier,
    bckOriginal,
    bckReleased,
    bckUnreleased,
    bckClaimable,
  } = useInvestment(address);

  const {
    balance: withdrawableBalance,
    feeBps,
    minWithdrawal,
    withdraw,
    isWithdrawing,
    isConfirming,
    isConfirmed,
  } = useWithdraw(address);

  const { records } = useIncomeRecords(address);

  const staticIncome = useMemo(() =>
    records.filter(r => r.name === "DeFi").reduce((sum, r) => sum + Number(r.amount), 0),
    [records]
  );
  const dynamicIncome = useMemo(() =>
    records.filter(r => r.name !== "DeFi" && !r.amount.startsWith("-") && r.name !== "BCK領取")
      .reduce((sum, r) => sum + Number(r.amount), 0),
    [records]
  );

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState<"usdt" | "bck">("usdt");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const capPercent = capLimit > 0n ? Number((totalEarned * 10000n) / capLimit) / 100 : 0;

  // Withdraw calculations
  const withdrawNum = parseFloat(withdrawAmount) || 0;
  const feePercent = feeBps / 100;
  const feeAmount = withdrawNum * (feePercent / 100);
  const netAmount = withdrawNum - feeAmount;
  const usdtWithdrawable = Number(formatUSDT(withdrawableBalance));
  const minWithdrawNum = Number(formatUnits(minWithdrawal, USDT_DECIMALS));
  const bckClaimableNum = Number(formatUnits(bckClaimable, BCK_DECIMALS));
  const isLoading = isWithdrawing || isConfirming;

  const handleWithdraw = async () => {
    if (withdrawCurrency === "usdt") {
      if (withdrawNum < minWithdrawNum || withdrawNum > usdtWithdrawable) return;
      setWithdrawError(null);
      try {
        await withdraw(withdrawNum);
        setWithdrawAmount("");
      } catch (err: unknown) {
        console.error("Withdraw error:", err);
        setWithdrawError(getErrorMessage(err, "Transaction failed"));
      }
    }
  };

  // Show skeleton while initial data loads
  const dataLoading = isConnected && address && balance === 0n && totalInvested === 0n && orders.length === 0 && capLimit === 0n;

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card glow className="text-center max-w-md">
          <div className="mb-4">
            <Wallet className="w-16 h-16 mx-auto text-accent" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold mb-2">{t("common.connectWallet")}</h2>
          <p className="text-muted">{t("landing.connectPrompt")}</p>
          <div className="mt-4"><ConnectButton /></div>
        </Card>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="rounded-xl border border-card-border bg-gradient-to-br from-card/95 to-card-elevated p-4 md:p-6 animate-pulse">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome Section */}
      <div className="animate-slide-up stagger-1">
      <Card variant="gradient" glow>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold mb-1">{t("dashboard.welcome")}</h1>
            <p className="text-muted font-mono text-xs md:text-sm">
              {address ? shortenAddress(address, 6) : ""}
            </p>
          </div>
          <Badge variant="success">{t("common.connected")}</Badge>
        </div>
      </Card>
      </div>

      {/* Balance Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-slide-up stagger-2">
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">{t("dashboard.usdtBalance")}</p>
          <p className="text-lg md:text-2xl font-bold text-accent">
            ${formatNumber(formatUSDT(balance))}
          </p>
          <div className="flex justify-between text-xs text-muted mt-2 pt-2 border-t border-card-border">
            <span>静态: ${formatNumber(staticIncome)}</span>
            <span>动态: ${formatNumber(dynamicIncome)}</span>
          </div>
        </Card>
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">{t("dashboard.totalInvested")}</p>
          <p className="text-lg md:text-2xl font-bold">
            ${formatNumber(formatUSDT(totalInvested))}
          </p>
        </Card>
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">{t("dashboard.totalEarned")}</p>
          <p className="text-lg md:text-2xl font-bold text-success">
            ${formatNumber(formatUSDT(totalEarned))}
          </p>
          <div className="flex justify-between text-xs text-muted mt-2 pt-2 border-t border-card-border">
            <span>静态产出: ${formatNumber(staticIncome)}</span>
            <span>动态收益: ${formatNumber(dynamicIncome)}</span>
          </div>
        </Card>
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">{t("dashboard.capRemaining")}</p>
          <p className="text-lg md:text-2xl font-bold text-warning">
            ${formatNumber(formatUSDT(capRemaining))}
          </p>
          <Progress value={capPercent} className="mt-2" />
          <p className="text-xs text-muted mt-1">{capPercent.toFixed(1)}% of {capMultiplier / 100}x cap used</p>
        </Card>
      </div>

      {/* BCK Info + Wallet USDT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 animate-slide-up stagger-4">
        <Card>
          <p className="text-muted text-xs md:text-sm mb-1">{t("dashboard.bckReleased")}</p>
          <p className="text-lg md:text-2xl font-bold text-success">
            {formatNumber(Number(formatUnits(bckReleased, BCK_DECIMALS)), 0)} BCK
          </p>
        </Card>
        <Card>
          <p className="text-muted text-xs md:text-sm mb-1">{t("dashboard.bckUnreleased")}</p>
          <p className="text-lg md:text-2xl font-bold text-warning">
            {formatNumber(Number(formatUnits(bckUnreleased, BCK_DECIMALS)), 0)} BCK
          </p>
        </Card>
        <Card>
          <p className="text-muted text-xs md:text-sm mb-1">USDT (Wallet)</p>
          <p className="text-lg md:text-2xl font-bold">
            ${formatNumber(formatUSDT(usdtBalance))}
          </p>
        </Card>
      </div>

      {/* Withdraw Section */}
      <div className="animate-slide-up stagger-5">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-bold">{t("dashboard.withdrawTitle")}</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowWithdraw(!showWithdraw)}
          >
            {showWithdraw ? t("common.cancel") : t("dashboard.withdrawFunds")}
          </Button>
        </div>

        {/* Balance summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className={`bg-background rounded-lg p-3 cursor-pointer border-2 transition-colors ${
              withdrawCurrency === "usdt" ? "border-accent" : "border-transparent"
            }`}
            onClick={() => { setWithdrawCurrency("usdt"); setWithdrawAmount(""); }}
          >
            <p className="text-muted text-xs mb-1">{t("wallet.availableBalance")} (USDT)</p>
            <p className="text-lg md:text-xl font-bold text-accent">${formatNumber(usdtWithdrawable)}</p>
          </div>
          <div
            className={`bg-background rounded-lg p-3 cursor-pointer border-2 transition-colors ${
              withdrawCurrency === "bck" ? "border-accent" : "border-transparent"
            }`}
            onClick={() => { setWithdrawCurrency("bck"); setWithdrawAmount(""); }}
          >
            <p className="text-muted text-xs mb-1">{t("wallet.availableBalance")} (BCK)</p>
            <p className="text-lg md:text-xl font-bold text-accent">{formatNumber(bckClaimableNum, 0)} BCK</p>
          </div>
        </div>

        {showWithdraw && (
          <div className="space-y-4 border-t border-card-border pt-4">
            {isConfirmed && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-3">
                <p className="text-success font-bold text-sm">{t("common.success")}</p>
              </div>
            )}
            {withdrawError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
                <p className="text-danger text-sm">{withdrawError}</p>
              </div>
            )}

            {withdrawCurrency === "usdt" ? (
              <>
                <div>
                  <label className="block text-sm text-muted mb-2">{t("wallet.withdrawAmount")}</label>
                  <Input
                    type="number"
                    placeholder={`${t("wallet.minWithdraw")} ${minWithdrawNum} USDT`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    min={minWithdrawNum}
                    disabled={isLoading}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[100, 500, 1000].map((preset) => (
                      <Button
                        key={preset}
                        variant="secondary"
                        size="sm"
                        onClick={() => setWithdrawAmount(preset.toString())}
                        disabled={isLoading}
                      >
                        ${preset}
                      </Button>
                    ))}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setWithdrawAmount(usdtWithdrawable.toString())}
                      disabled={isLoading}
                    >
                      {t("common.max")}
                    </Button>
                  </div>
                </div>

                {withdrawNum >= minWithdrawNum && (
                  <div className="bg-background rounded-lg p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">{t("wallet.amount")}</span>
                        <span className="font-mono">${formatNumber(withdrawNum)}</span>
                      </div>
                      <div className="flex justify-between text-danger">
                        <span>{t("wallet.fee")} ({feePercent}%)</span>
                        <span className="font-mono">-${formatNumber(feeAmount)}</span>
                      </div>
                      <hr className="border-card-border" />
                      <div className="flex justify-between font-bold">
                        <span>{t("wallet.youReceive")}</span>
                        <span className="text-success font-mono">${formatNumber(netAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {withdrawNum > 0 && withdrawNum < minWithdrawNum && (
                  <p className="text-danger text-sm">{t("wallet.minWithdraw")} {minWithdrawNum} USDT</p>
                )}
                {withdrawNum > usdtWithdrawable && (
                  <p className="text-danger text-sm">{t("wallet.available")}: ${formatNumber(usdtWithdrawable)}</p>
                )}

                <Button
                  className="w-full"
                  disabled={withdrawNum < minWithdrawNum || withdrawNum > usdtWithdrawable || isLoading}
                  onClick={handleWithdraw}
                >
                  {isWithdrawing ? (
                    <><Spinner /> Withdrawing...</>
                  ) : isConfirming ? (
                    <><Spinner /> Confirming...</>
                  ) : (
                    `${t("wallet.withdrawBtn")} $${formatNumber(netAmount > 0 ? netAmount : 0)} USDT`
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="bg-background rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">{t("restart.locked")}</span>
                      <span className="font-mono">{formatNumber(Number(formatUnits(bckOriginal, BCK_DECIMALS)), 0)} BCK</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t("dashboard.bckReleased")}</span>
                      <span className="font-mono text-success">{formatNumber(Number(formatUnits(bckReleased, BCK_DECIMALS)), 0)} BCK</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t("dashboard.bckUnreleased")}</span>
                      <span className="font-mono text-warning">{formatNumber(Number(formatUnits(bckUnreleased, BCK_DECIMALS)), 0)} BCK</span>
                    </div>
                    <hr className="border-card-border" />
                    <div className="flex justify-between font-bold">
                      <span>{t("restart.claimable")}</span>
                      <span className="text-accent font-mono">{formatNumber(bckClaimableNum, 0)} BCK</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted">{t("restart.step4")}</p>
                <a href="/restart">
                  <Button className="w-full">
                    {t("restart.claimMM")} {formatNumber(bckClaimableNum, 0)} BCK
                  </Button>
                </a>
              </>
            )}
          </div>
        )}
      </Card>
      </div>

      {/* Active Orders */}
      <div className="animate-slide-up stagger-6">
      <Card>
        <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4">{t("dashboard.activeOrders")}</h2>
        {/* Mobile: card layout */}
        <div className="sm:hidden space-y-3">
          {orders.map((order: ParsedOrder) => {
            const orderCapPercent = order.capLimit > 0n
              ? Number((order.totalReturned * 10000n) / order.capLimit) / 100
              : 0;
            const dateStr = new Date(order.createdAt * 1000).toLocaleDateString();
            return (
              <div key={order.id} className="bg-background rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted text-xs">#{order.id}</span>
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t("invest.orderCreated")}</span>
                  <span className="text-muted text-xs">{dateStr}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{t("dashboard.capProgress")}</span>
                    <span className="text-muted">{orderCapPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={orderCapPercent} className="h-2" />
                </div>
              </div>
            );
          })}
        </div>
        {/* Desktop: table layout */}
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
                const orderCapPercent = order.capLimit > 0n
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
                        <Progress value={orderCapPercent} className="flex-1 min-w-[80px] h-2" />
                        <span className="text-xs text-muted whitespace-nowrap">{orderCapPercent.toFixed(1)}%</span>
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
      </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 animate-slide-up stagger-7">
        <a href="/invest">
          <Card hoverable className="cursor-pointer text-center group">
            <div className="text-accent mb-1 md:mb-2">
              <Plus className="w-6 h-6 md:w-8 md:h-8 mx-auto" />
            </div>
            <p className="text-xs md:text-base font-bold group-hover:text-accent transition-colors">{t("dashboard.investNow")}</p>
            <p className="text-muted text-xs md:text-sm hidden sm:block">{t("dashboard.investDesc")}</p>
          </Card>
        </a>
        <a href="/financials">
          <Card hoverable className="cursor-pointer text-center group">
            <div className="text-warning mb-1 md:mb-2">
              <Bookmark className="w-6 h-6 md:w-8 md:h-8 mx-auto" />
            </div>
            <p className="text-xs md:text-base font-bold group-hover:text-warning transition-colors">{t("dashboard.claimIncome")}</p>
            <p className="text-muted text-xs md:text-sm hidden sm:block">{t("dashboard.claimDesc")}</p>
          </Card>
        </a>
      </div>
    </div>
  );
}
