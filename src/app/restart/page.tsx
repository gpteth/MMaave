"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { Contract, formatUnits, type InterfaceAbi } from "ethers";
import { formatNumber } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ADDRESSES, USDT_DECIMALS } from "@/lib/contracts";
import { memePlusAbi } from "@/lib/abi";
import { useState, useEffect, useCallback, useMemo } from "react";
import ConnectButton from "@/components/shared/ConnectButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, RefreshCw, RotateCcw } from "lucide-react";

export default function RestartPage() {
  const { address, isConnected, signer, readProvider } = useWeb3();
  const { t } = useLanguage();

  const [memberInfo, setMemberInfo] = useState<readonly unknown[] | null>(null);
  const [restartInfoResult, setRestartInfoResult] = useState<[bigint, bigint] | null>(null);
  const [tokenLockResult, setTokenLockResult] = useState<[bigint, bigint, number] | null>(null);
  const [restartRefCap, setRestartRefCap] = useState(150);
  const [restartMMRelease, setRestartMMRelease] = useState(100);
  const [capMultiplier, setCapMultiplier] = useState(250);

  const memePlus = useMemo(() => {
    return new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, readProvider);
  }, [readProvider]);

  const fetchData = useCallback(async () => {
    if (!address) return;
    try {
      const [info, restartInfo, tokenLock, refCap, mmRelease, capMul] = await Promise.all([
        memePlus.getMemberInfo(address),
        memePlus.getRestartInfo(address),
        memePlus.getTokenLock(address),
        memePlus.restartReferralCap(),
        memePlus.restartMMReleaseRate(),
        memePlus.capMultiplier(),
      ]);
      setMemberInfo(info);
      setRestartInfoResult([BigInt(restartInfo[0]), BigInt(restartInfo[1])]);
      setTokenLockResult([BigInt(tokenLock[0]), BigInt(tokenLock[1]), Number(tokenLock[2])]);
      setRestartRefCap(Number(refCap));
      setRestartMMRelease(Number(mmRelease));
      setCapMultiplier(Number(capMul));
    } catch (e) {
      console.error("RestartPage fetchData error:", e);
    }
  }, [address, memePlus]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Parse member info
  const isRestarted = Boolean(memberInfo?.[6]);
  const totalInvested = memberInfo ? BigInt(memberInfo[7] as bigint | number | string) : 0n;

  const unreturnedCapital = restartInfoResult?.[0] ?? 0n;
  const referralEarned = restartInfoResult?.[1] ?? 0n;
  const mmRemaining = tokenLockResult?.[0] ?? 0n;
  const mmOriginal = tokenLockResult?.[1] ?? 0n;
  const lockedAt = Number(tokenLockResult?.[2] ?? 0);

  // Calculations
  const capLimit = capMultiplier > 0 ? (totalInvested * BigInt(capMultiplier)) / 100n : 0n;
  const totalEarnedBeforeRestart = capLimit > unreturnedCapital ? capLimit - unreturnedCapital : 0n;

  const referralCap = (unreturnedCapital * BigInt(restartRefCap)) / 100n;
  const referralProgress = referralCap > 0n ? Math.min(Number((referralEarned * 100n) / referralCap), 100) : 0;

  const mmReleased = mmOriginal - mmRemaining;
  const mmDailyRelease = mmOriginal > 0n ? (mmOriginal * BigInt(restartMMRelease)) / 10000n : 0n;

  // Calculate claimable MM (linear release)
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const elapsed = lockedAt > 0 ? nowSec - BigInt(lockedAt) : 0n;
  const daysPassed = elapsed / 86400n;
  const totalReleasable = mmOriginal > 0n
    ? ((mmOriginal * BigInt(restartMMRelease)) / 10000n) * daysPassed
    : 0n;
  const totalReleasableCapped = totalReleasable > mmOriginal ? mmOriginal : totalReleasable;
  const mmClaimable = totalReleasableCapped > mmReleased ? totalReleasableCapped - mmReleased : 0n;

  const restartDate = lockedAt > 0 ? new Date(lockedAt * 1000).toISOString().split("T")[0] : "—";

  const handleClaimMM = async () => {
    if (!address || !signer) return;
    const memePlusWithSigner = new Contract(ADDRESSES.MEMEPLUS, memePlusAbi as InterfaceAbi, signer);
    const tx = await memePlusWithSigner.claimMMCompensation(address);
    await tx.wait();
    setTimeout(() => fetchData(), 3000);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card glow className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">{t("common.connectWallet")}</h2>
          <p className="text-muted">{t("restart.notRestarted")}</p>
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
          <RotateCcw className="w-5 h-5 text-accent" />
          <h1 className="text-xl md:text-2xl font-bold">{t("restart.title")}</h1>
        </div>
        <p className="text-muted text-sm">{t("restart.currentStatus")}</p>
      </div>

      {/* Current Status */}
      <Card
        glow
        className={`border-l-4 animate-slide-up stagger-2 ${isRestarted ? "border-l-warning" : "border-l-success"}`}
      >
        <div className="flex items-center gap-3 md:gap-4">
          <div className={`w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0 ${
            isRestarted ? "bg-warning/20" : "bg-success/20"
          }`}>
            {isRestarted ? (
              <RefreshCw className="w-5 h-5 md:w-7 md:h-7 text-warning" />
            ) : (
              <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7 text-success" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold">
              {isRestarted ? t("restart.restarted") : t("common.active")}
            </h2>
            <p className="text-muted text-sm">
              {isRestarted
                ? `${t("restart.restarted")} ${restartDate}`
                : t("restart.notRestarted")}
            </p>
          </div>
          <Badge className="ml-auto" variant={isRestarted ? "warning" : "success"}>
            {isRestarted ? t("restart.restarted") : t("common.active")}
          </Badge>
        </div>
      </Card>

      {isRestarted && (
        <>
          {/* Unreturned Capital */}
          <Card className="animate-slide-up stagger-3">
            <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4">{t("restart.unreturnedCapital")}</h3>
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
                <p className="text-muted text-xs md:text-sm mb-1">{t("restart.originalInvestment")}</p>
                <p className="text-base md:text-xl font-bold">${formatNumber(Number(formatUnits(totalInvested, USDT_DECIMALS)))}</p>
              </div>
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
                <p className="text-muted text-xs md:text-sm mb-1">{t("restart.earnedBefore")}</p>
                <p className="text-base md:text-xl font-bold text-success">${formatNumber(Number(formatUnits(totalEarnedBeforeRestart, USDT_DECIMALS)))}</p>
              </div>
              <div className="bg-background/60 border border-danger/25 rounded-xl p-2.5 md:p-4">
                <p className="text-muted text-xs md:text-sm mb-1">{t("restart.unreturned")}</p>
                <p className="text-base md:text-xl font-bold text-danger">${formatNumber(Number(formatUnits(unreturnedCapital, USDT_DECIMALS)))}</p>
              </div>
            </div>
          </Card>

          {/* Referral Compensation */}
          <Card className="animate-slide-up stagger-4">
            <h3 className="text-lg font-bold mb-4">{t("restart.referralComp")}</h3>
            <p className="text-sm text-muted mb-4">{t("restart.referralCompDesc")}</p>
            <div className="bg-background/60 border border-card-border/60 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-muted">{t("restart.referralComp")}</span>
                <span>
                  <span className="text-success font-mono">${formatNumber(Number(formatUnits(referralEarned, USDT_DECIMALS)))}</span>
                  <span className="text-muted"> / ${formatNumber(Number(formatUnits(referralCap, USDT_DECIMALS)))}</span>
                </span>
              </div>
              <Progress value={referralProgress} className="h-3" />
              <p className="text-xs text-muted mt-2">
                {referralProgress.toFixed(1)}% {t("restart.earnedOf")} {restartRefCap / 100}x
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-4">
                <p className="text-muted text-sm mb-1">已获补偿</p>
                <p className="text-xl font-bold text-success">${formatNumber(Number(formatUnits(referralEarned, USDT_DECIMALS)))}</p>
              </div>
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-4">
                <p className="text-muted text-sm mb-1">剩余可获</p>
                <p className="text-xl font-bold text-warning">
                  ${formatNumber(Number(formatUnits(referralCap > referralEarned ? referralCap - referralEarned : 0n, USDT_DECIMALS)))}
                </p>
              </div>
            </div>
          </Card>

          {/* MM Token Compensation */}
          <Card className="animate-slide-up stagger-5">
            <h3 className="text-lg font-bold mb-4">{t("restart.mmComp")}</h3>
            <p className="text-sm text-muted mb-4">{t("restart.step4")}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4">
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
                <p className="text-muted text-xs md:text-sm mb-1">{t("restart.locked")}</p>
                <p className="text-base md:text-xl font-bold text-accent">{formatNumber(Number(formatUnits(mmOriginal, USDT_DECIMALS)), 0)} BCK</p>
              </div>
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
                <p className="text-muted text-xs md:text-sm mb-1">{t("restart.released")}</p>
                <p className="text-base md:text-xl font-bold">{formatNumber(Number(formatUnits(mmReleased, USDT_DECIMALS)), 0)} BCK</p>
              </div>
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-2.5 md:p-4">
                <p className="text-muted text-xs md:text-sm mb-1">{t("restart.dailyRelease")}</p>
                <p className="text-base md:text-xl font-bold text-success">+{formatNumber(Number(formatUnits(mmDailyRelease, USDT_DECIMALS)), 0)} BCK</p>
              </div>
              <div className="bg-background/60 border border-accent/25 rounded-xl p-2.5 md:p-4">
                <p className="text-muted text-xs md:text-sm mb-1">{t("restart.claimable")}</p>
                <p className="text-base md:text-xl font-bold text-accent">{formatNumber(Number(formatUnits(mmClaimable, USDT_DECIMALS)), 0)} BCK</p>
              </div>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={mmClaimable <= 0n}
              onClick={handleClaimMM}
            >
              {t("restart.claimMM")} {formatNumber(Number(formatUnits(mmClaimable, USDT_DECIMALS)), 0)} BCK
            </Button>
          </Card>
        </>
      )}

      {/* Explanation */}
      <Card className="animate-slide-up stagger-6">
        <h3 className="text-lg font-bold mb-4">{t("restart.mechanism")}</h3>
        <div className="space-y-4 text-sm text-muted">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">1</div>
            <div><p className="font-bold text-foreground">{t("restart.step1")}</p></div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">2</div>
            <div><p className="font-bold text-foreground">{t("restart.step2")}</p></div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">3</div>
            <div><p className="font-bold text-foreground">{t("restart.step3")}</p></div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">4</div>
            <div><p className="font-bold text-foreground">{t("restart.step4")}</p></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
