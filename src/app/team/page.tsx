"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { formatUnits } from "ethers";
import { shortenAddress, formatNumber } from "@/lib/utils";
import { useTeamData } from "@/hooks/useTeamData";
import { USDT_DECIMALS } from "@/lib/contracts";
import { useLanguage } from "@/components/providers/LanguageProvider";
import ConnectButton from "@/components/shared/ConnectButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { BarChart3, Link2, UserPlus } from "lucide-react";

// V-Level 颜色配置 (index = vLevel: 0=V0, 1=V1, ..., 7=V7)
const vLevelColors = [
  "text-muted",        // V0
  "text-muted",        // V1
  "text-accent-light", // V2
  "text-accent",       // V3
  "text-success",      // V4
  "text-warning",      // V5
  "text-danger",       // V6
  "text-pink-500",     // V7
];

export default function TeamPage() {
  const { address, isConnected } = useWeb3();
  const { t } = useLanguage();
  const {
    vLevel,
    directReferrals,
    totalPerformance,
    largeZone,
    smallZone,
    nextVLevelThreshold,
    referrals,
    referrer,
  } = useTeamData(address);

  const vLevelLabel = `V${vLevel}`;
  const vLevelColor = vLevelColors[vLevel] ?? "text-muted";
  const isMaxLevel = vLevel >= 7;

  const totalPerfNum = Number(formatUnits(totalPerformance, USDT_DECIMALS));
  const largeZoneNum = Number(formatUnits(largeZone, USDT_DECIMALS));
  const smallZoneNum = Number(formatUnits(smallZone, USDT_DECIMALS));
  const nextThresholdNum = nextVLevelThreshold > 0n
    ? Number(formatUnits(nextVLevelThreshold, USDT_DECIMALS))
    : 0;

  // V等级升级进度: 只看小区业绩 vs 下一级门槛
  const perfProgress = nextThresholdNum > 0
    ? Math.min((smallZoneNum / nextThresholdNum) * 100, 100)
    : 100;

  const hasReferrer =
    Boolean(referrer) &&
    referrer !== "0x0000000000000000000000000000000000000000";

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
    <div className="space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="animate-slide-up stagger-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent" />
          <h1 className="text-xl md:text-2xl font-bold">{t("team.title")}</h1>
        </div>
        <p className="text-muted text-sm">{t("team.referralTree")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-slide-up stagger-2">
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">
            {t("team.myReferrer")}（绑定地址）
          </p>
          <div className="flex items-start gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm md:text-base font-mono truncate">
                {hasReferrer ? shortenAddress(referrer as string, 6) : "-"}
              </p>
              <p className="text-xs text-muted font-mono break-all mt-1">
                {hasReferrer ? (referrer as string) : "-"}
              </p>
            </div>
          </div>
        </Card>
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">{t("team.vLevel")}</p>
          <p className={`text-lg md:text-2xl font-bold ${vLevelColor}`}>{vLevelLabel}</p>
          <p className="text-xs text-muted mt-1">
            {t("team.totalPerformance")}: ${formatNumber(totalPerfNum)}
          </p>
        </Card>
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">{t("team.directReferrals")}</p>
          <p className="text-lg md:text-2xl font-bold">{directReferrals}</p>
        </Card>
        <Card variant="stat">
          <p className="text-muted text-xs md:text-sm mb-1">{t("team.generationsUnlocked")}</p>
          <p className="text-lg md:text-2xl font-bold text-success">
            {Math.min(directReferrals, 2)}/2
          </p>
        </Card>
      </div>

      {/* Direct Referrals List */}
      <Card className="animate-slide-up stagger-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-accent" />
            <h2 className="text-base md:text-lg font-bold">
              {t("team.directReferrals")} ({referrals.length})
            </h2>
          </div>
        </div>
        {referrals.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">{t("team.noReferrals")}</p>
        ) : (
          <>
            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2">
              {referrals.map((ref, i) => (
                <div
                  key={i}
                  className="bg-background/60 border border-card-border/60 rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs truncate">{shortenAddress(ref.address, 6)}</p>
                    <p className="text-sm font-mono mt-0.5">${formatNumber(Number(formatUnits(ref.invested, USDT_DECIMALS)))}</p>
                  </div>
                  <Badge
                    className="shrink-0 ml-2"
                    variant={ref.isActive ? "success" : "danger"}
                  >
                    {ref.isActive ? t("common.active") : t("common.inactive")}
                  </Badge>
                </div>
              ))}
            </div>
            {/* Desktop: table layout */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("admin.address")}</TableHead>
                    <TableHead>{t("team.invested")}</TableHead>
                    <TableHead>{t("wallet.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((ref, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">
                        {shortenAddress(ref.address, 6)}
                      </TableCell>
                      <TableCell className="font-mono">
                        ${formatNumber(Number(formatUnits(ref.invested, USDT_DECIMALS)))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ref.isActive ? "success" : "danger"}>
                          {ref.isActive ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* V-Level Badge + Upgrade Progress */}
      <Card variant="gradient" glow className="animate-slide-up stagger-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6">
          <div className="text-center">
            <div className={`text-4xl md:text-5xl font-black ${vLevelColor}`}>
              {vLevelLabel}
            </div>
            <p className="text-xs md:text-sm text-muted mt-1">{t("team.vLevel")}</p>
          </div>
          {!isMaxLevel && nextThresholdNum > 0 ? (
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{t("team.progressTo")} V{vLevel + 1}</span>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">{t("team.smallZone")}</span>
                  <span>${formatNumber(smallZoneNum)} / ${formatNumber(nextThresholdNum)}</span>
                </div>
                <Progress value={perfProgress} />
              </div>
            </div>
          ) : (
            <div className="flex-1 text-center">
              <Badge variant="success" className="text-base px-4 py-2">
                {t("team.maxLevel")}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Performance */}
      <Card className="animate-slide-up stagger-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-4">
          <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            {t("team.totalPerformance")}
          </h2>
          <Badge className="w-fit" variant="default">
            ${formatNumber(totalPerfNum)}
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="bg-background/60 border border-card-border/60 rounded-xl p-3 md:p-4">
            <p className="text-muted text-xs md:text-sm mb-1">{t("team.largeZone")}</p>
            <p className="text-lg md:text-xl font-bold">${formatNumber(largeZoneNum)}</p>
            {totalPerfNum > 0 ? (
              <Progress value={(largeZoneNum / totalPerfNum) * 100} className="mt-2" />
            ) : null}
          </div>
          <div className="bg-background/60 border border-card-border/60 rounded-xl p-3 md:p-4">
            <p className="text-muted text-xs md:text-sm mb-1">{t("team.smallZone")}</p>
            <p className="text-lg md:text-xl font-bold">${formatNumber(smallZoneNum)}</p>
            {totalPerfNum > 0 ? (
              <Progress value={(smallZoneNum / totalPerfNum) * 100} className="mt-2" />
            ) : null}
          </div>
        </div>
      </Card>

    </div>
  );
}
