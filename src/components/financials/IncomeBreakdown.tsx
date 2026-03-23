"use client";

import { useState } from "react";

interface IncomeBreakdownProps {
  staticIncome: {
    total: number;
    toBalance: number;
    toBurn: number;
    toLock: number;
  };
  dynamicIncome: {
    referralRewards: { gen: number; rate: string; earned: number }[];
    teamRewards: number;
    total: number;
  };
  communityIncome: {
    levelDiffEarnings: { tier: number; earned: number }[];
    total: number;
  };
}

type Tab = "static" | "dynamic" | "community";

export default function IncomeBreakdown({
  staticIncome,
  dynamicIncome,
  communityIncome,
}: IncomeBreakdownProps) {
  const [activeTab, setActiveTab] = useState<Tab>("static");

  const tabs: { key: Tab; label: string; amount: number }[] = [
    { key: "static", label: "DeFi Income", amount: staticIncome.total },
    { key: "dynamic", label: "Evangelism Income", amount: dynamicIncome.total },
    { key: "community", label: "Community Income", amount: communityIncome.total },
  ];

  return (
    <div className="card">
      <div className="flex gap-1 mb-6 bg-background rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="block text-xs mt-0.5 opacity-75">
              {tab.amount.toLocaleString()} USDT
            </span>
          </button>
        ))}
      </div>

      {activeTab === "static" && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted">Daily Return Distribution</h4>
          <div className="bg-background rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-accent" />
                <span className="text-sm">To Balance</span>
              </div>
              <span className="font-semibold">{staticIncome.toBalance.toLocaleString()} USDT</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-sm">BCK Burn</span>
              </div>
              <span className="font-semibold">{staticIncome.toBurn.toLocaleString()} USDT</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm">BCK Lock</span>
              </div>
              <span className="font-semibold">{staticIncome.toLock.toLocaleString()} USDT</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "dynamic" && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-muted mb-3">Referral Rewards</h4>
            <div className="bg-background rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left p-3 text-muted">Generation</th>
                    <th className="text-right p-3 text-muted">Rate</th>
                    <th className="text-right p-3 text-muted">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {dynamicIncome.referralRewards.map((r) => (
                    <tr key={r.gen} className="border-b border-card-border last:border-0">
                      <td className="p-3">Gen {r.gen}</td>
                      <td className="p-3 text-right text-accent">{r.rate}</td>
                      <td className="p-3 text-right font-semibold">{r.earned.toLocaleString()} USDT</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-background rounded-lg p-4 flex justify-between items-center">
            <span className="text-sm text-muted">Team Rewards</span>
            <span className="font-semibold">{dynamicIncome.teamRewards.toLocaleString()} USDT</span>
          </div>
        </div>
      )}

      {activeTab === "community" && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted">Level Differential Income (Not counted toward cap)</h4>
          <div className="bg-background rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left p-3 text-muted">Tier</th>
                  <th className="text-right p-3 text-muted">Earned</th>
                </tr>
              </thead>
              <tbody>
                {communityIncome.levelDiffEarnings.map((l) => (
                  <tr key={l.tier} className="border-b border-card-border last:border-0">
                    <td className="p-3">Tier {l.tier}</td>
                    <td className="p-3 text-right font-semibold">{l.earned.toLocaleString()} USDT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-xs text-accent">
            Community income from level differential does not count toward your 2.5x cap limit.
          </div>
        </div>
      )}
    </div>
  );
}
