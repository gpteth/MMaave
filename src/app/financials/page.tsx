"use client";

import { useWeb3 } from "@/contexts/Web3Context";
import { formatUnits } from "ethers";
import { formatNumber } from "@/lib/utils";
import { useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useInvestment } from "@/hooks/useInvestment";
import { useDynamicBonus } from "@/hooks/useDynamicBonus";
import { useIncomeRecords } from "@/hooks/useIncomeRecords";
import { USDT_DECIMALS } from "@/lib/contracts";
import ConnectButton from "@/components/shared/ConnectButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Coins, TrendingUp } from "lucide-react";

type TabKey = "static" | "dynamic";

export default function FinancialsPage() {
  const { address, isConnected } = useWeb3();
  const [activeTab, setActiveTab] = useState<TabKey>("static");
  const { t } = useLanguage();

  const { totalEarned, capLimit, totalInvested } = useInvestment(address);
  const { referralRewards, referralShareBps, teamShareBps, sameLevelBonusBps } = useDynamicBonus(address);
  const { records, isLoading: recordsLoading } = useIncomeRecords(address);

  const defiRecords = records.filter(r => r.name === "DeFi");
  const dynamicRecords = records.filter(r => r.name !== "DeFi" && !r.amount.startsWith("-") && r.name !== "BCK領取");

  const formatRecordTime = (ts: number) => {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const totalEarnedNum = Number(formatUnits(totalEarned, USDT_DECIMALS));
  const capLimitNum = Number(formatUnits(capLimit, USDT_DECIMALS));
  const capPercent = capLimitNum > 0 ? (totalEarnedNum / capLimitNum) * 100 : 0;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "static", label: t("fin.staticIncome") },
    { key: "dynamic", label: t("fin.dynamicIncome") },
  ];

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
          <TrendingUp className="w-5 h-5 text-accent" />
          <h1 className="text-xl md:text-2xl font-bold">{t("fin.title")}</h1>
        </div>
        <p className="text-muted text-sm">{t("fin.title")}</p>
      </div>

      {/* Total Earned vs Cap */}
      <Card variant="gradient" glow className="animate-slide-up stagger-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div>
            <p className="text-muted text-xs md:text-sm">{t("fin.totalEarned")}</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-success">${formatNumber(totalEarnedNum)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-muted text-xs md:text-sm">{t("fin.capLimit")} (2.5x)</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold">${formatNumber(capLimitNum)}</p>
          </div>
        </div>
        <Progress value={capPercent} className="h-4" />
        <div className="flex justify-between text-xs text-muted mt-2">
          <span>{capPercent.toFixed(1)}% used</span>
          <span>${formatNumber(Math.max(capLimitNum - totalEarnedNum, 0))} remaining</span>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="grid grid-cols-2 gap-2 animate-slide-up stagger-3">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            variant={activeTab === tab.key ? "default" : "secondary"}
            className="w-full justify-center"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* DeFi Income Tab */}
      {activeTab === "static" && (
        <div className="space-y-4 animate-slide-up stagger-4">
          <Card>
            <div className="bg-background/60 border border-card-border/60 rounded-xl p-4 mb-4">
              <p className="text-muted text-sm mb-1">累计DeFi收益</p>
              <p className="text-3xl font-bold text-success">${formatNumber(totalEarnedNum)}</p>
            </div>
          </Card>
          <Card>
            <h3 className="text-base font-bold mb-3">DeFi收入明细</h3>
            {recordsLoading ? (
              <p className="text-muted text-sm text-center py-4">{t("common.loading")}</p>
            ) : defiRecords.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">暂无DeFi收入记录</p>
            ) : (
              <>
                <div className="sm:hidden space-y-2">
                  {defiRecords.map((record, i) => (
                    <div key={i} className="bg-background rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{record.name}</p>
                        <p className="text-xs text-muted">{formatRecordTime(record.timestamp)}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-success">+{formatNumber(Number(record.amount))}</span>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>类型</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                        <TableHead className="text-right">时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defiRecords.map((record, i) => (
                        <TableRow key={i}>
                          <TableCell>{record.name}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-success">+{formatNumber(Number(record.amount))}</TableCell>
                          <TableCell className="text-right text-muted">{formatRecordTime(record.timestamp)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Dynamic Income Tab */}
      {activeTab === "dynamic" && (
        <div className="space-y-4 animate-slide-up stagger-4">
          {/* Referral Rewards */}
          <Card>
            <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-accent" />
              {t("fin.referralRewards")}
            </h3>
            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2">
              {referralRewards.map((row) => (
                <div
                  key={row.gen}
                  className="bg-background/60 border border-card-border/60 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <Badge variant="success">
                      {t("team.generation")} {row.gen}
                    </Badge>
                  </div>
                  <span className="font-mono text-accent font-bold text-sm">{row.rateDisplay}</span>
                </div>
              ))}
            </div>
            {/* Desktop: table layout */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("team.generation")}</TableHead>
                    <TableHead className="text-right">{t("fin.rate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralRewards.map((row) => (
                    <TableRow key={row.gen}>
                      <TableCell>
                        <Badge variant="success">
                          {t("team.generation")} {row.gen}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-accent font-bold">
                        {row.rateDisplay}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Team Rewards */}
          <Card>
            <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4">{t("fin.teamRewards")}</h3>
            <div className="space-y-2">
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm">推荐池比例</span>
                <span className="font-mono text-accent font-bold">{referralShareBps / 100}%</span>
              </div>
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm">团队池比例</span>
                <span className="font-mono text-warning font-bold">{teamShareBps / 100}%</span>
              </div>
              <div className="bg-background/60 border border-card-border/60 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm">平级奖比例</span>
                <span className="font-mono text-success font-bold">{sameLevelBonusBps / 100}%</span>
              </div>
            </div>
          </Card>

          {/* Dynamic Income Records */}
          <Card>
            <h3 className="text-base font-bold mb-3">布道收入明细</h3>
            {recordsLoading ? (
              <p className="text-muted text-sm text-center py-4">{t("common.loading")}</p>
            ) : dynamicRecords.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">暂无布道收入记录</p>
            ) : (
              <>
                <div className="sm:hidden space-y-2">
                  {dynamicRecords.map((record, i) => (
                    <div key={i} className="bg-background rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{record.name}</p>
                        <p className="text-xs text-muted">{formatRecordTime(record.timestamp)}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-success">+{formatNumber(Number(record.amount))}</span>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>类型</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                        <TableHead className="text-right">时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dynamicRecords.map((record, i) => (
                        <TableRow key={i}>
                          <TableCell>{record.name}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-success">+{formatNumber(Number(record.amount))}</TableCell>
                          <TableCell className="text-right text-muted">{formatRecordTime(record.timestamp)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Total invested reference */}
      <Card variant="stat" className="animate-slide-up stagger-5">
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">总投资额</span>
          <span className="font-mono font-bold">${formatNumber(Number(formatUnits(totalInvested, USDT_DECIMALS)))}</span>
        </div>
      </Card>
    </div>
  );
}
