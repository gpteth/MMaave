"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { formatUSDT, formatNumber, getErrorMessage } from "@/lib/utils";
import { Contract, formatUnits, type InterfaceAbi } from "ethers";
import { useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useInvestment } from "@/hooks/useInvestment";
import { useWithdraw } from "@/hooks/useWithdraw";
import { useIncomeRecords } from "@/hooks/useIncomeRecords";
import { ADDRESSES, USDT_DECIMALS } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import ConnectButton from "@/components/shared/ConnectButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Coins, History, Wallet } from "lucide-react";

const BCK_DECIMALS = 18;

type WithdrawTab = "usdt" | "bck";

export default function WalletPage() {
  const { address, isConnected, signer } = useWeb3();
  const [activeTab, setActiveTab] = useState<WithdrawTab>("usdt");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const { t } = useLanguage();

  const {
    mmBalance,
    bckOriginal,
    bckReleased,
    bckClaimable,
    bckDailyRelease,
    refetch: refetchInvestment,
  } = useInvestment(address);

  const {
    balance,
    feeBps,
    minWithdrawal,
    withdraw,
    isWithdrawing,
    isConfirming,
    isConfirmed,
  } = useWithdraw(address);

  const { records, isLoading: recordsLoading } = useIncomeRecords(address);

  const withdrawNum = parseFloat(withdrawAmount) || 0;
  const feePercent = feeBps / 100;
  const feeAmount = withdrawNum * (feePercent / 100);
  const netAmount = withdrawNum - feeAmount;
  const balanceNum = Number(formatUSDT(balance));
  const minWithdrawNum = Number(formatUnits(minWithdrawal, USDT_DECIMALS));
  const isLoading = isWithdrawing || isConfirming;

  const handleWithdraw = async () => {
    if (withdrawNum < minWithdrawNum || withdrawNum > balanceNum) return;
    setError(null);
    try {
      await withdraw(withdrawNum);
    } catch (err: unknown) {
      console.error("Withdraw error:", err);
      setError(getErrorMessage(err, "Transaction failed"));
    }
  };

  const handleClaimBCK = async () => {
    if (!address || !signer || bckClaimable <= 0n) return;
    setIsClaiming(true);
    setError(null);
    try {
      const memePlusWithSigner = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, signer);
      const tx = await memePlusWithSigner.claimMMCompensation(address);
      await tx.wait();
      setTimeout(() => refetchInvestment(), 3000);
    } catch (err: unknown) {
      console.error("Claim BCK error:", err);
      setError(getErrorMessage(err, "Transaction failed"));
    } finally {
      setIsClaiming(false);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const formatSource = (source: string) => {
    if (source.startsWith("0x") && source.length === 42) {
      return `${source.slice(0, 6)}...${source.slice(-4)}`;
    }
    return source;
  };

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
      {/* Page Header */}
      <div className="animate-slide-up stagger-1">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-accent" />
          <h1 className="text-xl md:text-2xl font-bold">{t("wallet.title")}</h1>
        </div>
        <p className="text-muted text-sm">{t("wallet.selectCurrency")}</p>
      </div>

      {/* Success / Error */}
      {isConfirmed && (
        <Card className="bg-success/10 border-success/30">
          <p className="text-success font-bold">Withdrawal successful!</p>
        </Card>
      )}
      {error && (
        <Card className="bg-danger/10 border-danger/30">
          <p className="text-danger text-sm">{error}</p>
        </Card>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 animate-slide-up stagger-2">
        {/* Contract Balance (withdrawable USDT) */}
        <Card variant="stat" glow>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/20 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-muted text-xs md:text-sm">{t("wallet.availableBalance")}</p>
              <p className="text-2xl md:text-3xl font-bold truncate">
                ${formatNumber(formatUSDT(balance))}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted">{t("wallet.available")} USDT</p>
        </Card>

        {/* BCK Claimable */}
        <Card variant="stat">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
              <span className="text-accent font-bold text-base md:text-lg">B</span>
            </div>
            <div>
              <p className="text-muted text-xs md:text-sm">{t("wallet.bckClaimable")}</p>
              <p className="text-2xl md:text-3xl font-bold text-accent">{formatNumber(Number(formatUnits(bckClaimable, USDT_DECIMALS)), 0)} BCK</p>
            </div>
          </div>
        </Card>

        {/* Wallet BCK Balance */}
        <Card variant="stat">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/20 flex items-center justify-center shrink-0">
              <span className="text-warning font-bold text-base md:text-lg">B</span>
            </div>
            <div>
              <p className="text-muted text-xs md:text-sm">{t("wallet.mmBalance")}</p>
              <p className="text-2xl md:text-3xl font-bold text-warning">{formatNumber(Number(formatUnits(mmBalance, BCK_DECIMALS)))} BCK</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Currency Tab Selector */}
      <div className="grid grid-cols-2 gap-2 animate-slide-up stagger-3">
        <Button
          onClick={() => { setActiveTab("usdt"); setError(null); }}
          variant={activeTab === "usdt" ? "default" : "secondary"}
          className="w-full justify-center"
        >
          USDT {t("wallet.withdrawBtn")}
        </Button>
        <Button
          onClick={() => { setActiveTab("bck"); setError(null); }}
          variant={activeTab === "bck" ? "default" : "secondary"}
          className="w-full justify-center"
        >
          BCK {t("wallet.withdrawBtn")}
        </Button>
      </div>

      {/* USDT Withdrawal Form */}
      {activeTab === "usdt" && (
        <Card className="animate-slide-up stagger-4">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-accent" />
            {t("wallet.withdraw")}
          </h2>
          <div className="space-y-4">
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
                    onClick={() => setWithdrawAmount(preset.toString())}
                    variant="secondary"
                    size="sm"
                    disabled={isLoading}
                  >
                    ${preset}
                  </Button>
                ))}
                <Button
                  onClick={() => setWithdrawAmount(balanceNum.toString())}
                  variant="secondary"
                  size="sm"
                  disabled={isLoading}
                >
                  {t("common.max")}
                </Button>
              </div>
            </div>

            {/* Fee Preview */}
            {withdrawNum >= minWithdrawNum && (
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-4">
                <h3 className="text-sm font-bold text-muted mb-3">{t("wallet.withdrawalAmount")}</h3>
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
            {withdrawNum > balanceNum && (
              <p className="text-danger text-sm">{t("wallet.available")}: ${formatNumber(balanceNum)}</p>
            )}

            <Button
              className="w-full"
              disabled={withdrawNum < minWithdrawNum || withdrawNum > balanceNum || isLoading}
              onClick={handleWithdraw}
            >
              {isWithdrawing ? (
                <>
                  <Spinner /> Withdrawing...
                </>
              ) : isConfirming ? (
                <>
                  <Spinner /> Confirming...
                </>
              ) : (
                `${t("wallet.withdrawBtn")} $${formatNumber(netAmount > 0 ? netAmount : 0)} USDT`
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* BCK Withdrawal */}
      {activeTab === "bck" && (
        <Card className="animate-slide-up stagger-4">
          <h2 className="text-lg font-bold mb-4">{t("wallet.claimBCK")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4">
            <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
              <p className="text-muted text-xs md:text-sm mb-1">{t("wallet.bckLocked")}</p>
              <p className="text-base md:text-xl font-bold text-accent">{formatNumber(Number(formatUnits(bckOriginal, USDT_DECIMALS)), 0)} BCK</p>
            </div>
            <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
              <p className="text-muted text-xs md:text-sm mb-1">{t("wallet.bckReleased")}</p>
              <p className="text-base md:text-xl font-bold">{formatNumber(Number(formatUnits(bckReleased, USDT_DECIMALS)), 0)} BCK</p>
            </div>
            <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
              <p className="text-muted text-xs md:text-sm mb-1">{t("wallet.bckDailyRelease")}</p>
              <p className="text-base md:text-xl font-bold text-success">+{formatNumber(Number(formatUnits(bckDailyRelease, USDT_DECIMALS)), 0)} BCK</p>
            </div>
            <div className="bg-background/60 border border-accent/25 rounded-xl p-2.5 md:p-4">
              <p className="text-muted text-xs md:text-sm mb-1">{t("wallet.bckClaimable")}</p>
              <p className="text-base md:text-xl font-bold text-accent">{formatNumber(Number(formatUnits(bckClaimable, USDT_DECIMALS)), 0)} BCK</p>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={bckClaimable <= 0n || isClaiming}
            onClick={handleClaimBCK}
          >
            {isClaiming ? (
              <>
                <Spinner /> Claiming...
              </>
            ) : (
              `${t("wallet.claimBCK")} ${formatNumber(Number(formatUnits(bckClaimable, USDT_DECIMALS)), 0)} BCK`
            )}
          </Button>
        </Card>
      )}

      {/* Income Records */}
      <Card className="animate-slide-up stagger-5">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-accent" />
          {t("wallet.incomeRecords")}
        </h2>

        {recordsLoading ? (
          <div className="flex items-center justify-center py-6 text-muted text-sm gap-2">
            <Spinner /> {t("common.loading")}
          </div>
        ) : records.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">{t("wallet.noRecords")}</p>
        ) : (
          <>
            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2">
              {records.map((record, i) => (
                <div
                  key={i}
                  className="bg-background/60 border border-card-border/60 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{record.name}</p>
                    <p className="text-xs text-muted">{formatSource(record.source)} · {formatTime(record.timestamp)}</p>
                  </div>
                  <span className={`font-mono text-sm font-bold ${
                    record.amount.startsWith("-") ? "text-danger" : "text-success"
                  }`}>
                    {record.amount.startsWith("-") ? "" : "+"}{formatNumber(Number(record.amount))}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("wallet.incomeName")}</TableHead>
                    <TableHead>來源</TableHead>
                    <TableHead className="text-right">{t("wallet.incomeAmount")}</TableHead>
                    <TableHead className="text-right">{t("wallet.incomeTime")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, i) => (
                    <TableRow key={i}>
                      <TableCell>{record.name}</TableCell>
                      <TableCell className="text-muted font-mono text-xs">
                        {formatSource(record.source)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-bold ${
                          record.amount.startsWith("-") ? "text-danger" : "text-success"
                        }`}
                      >
                        {record.amount.startsWith("-") ? "" : "+"}
                        {formatNumber(Number(record.amount))}
                      </TableCell>
                      <TableCell className="text-right text-muted">
                        {formatTime(record.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
