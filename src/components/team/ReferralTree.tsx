"use client";

import { shortenAddress } from "@/lib/utils";

interface Referral {
  address: string;
  invested: number;
  isActive: boolean;
  referrals?: Referral[];
}

interface ReferralTreeProps {
  referrals: Referral[];
  generation?: number;
}

export default function ReferralTree({ referrals, generation = 1 }: ReferralTreeProps) {
  if (referrals.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-muted">No referrals yet</p>
        <p className="text-sm text-muted mt-1">Share your referral link to build your team</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {referrals.map((ref) => (
        <div key={ref.address}>
          <div
            className="flex items-center gap-3 bg-background rounded-lg p-3 border border-card-border"
            style={{ marginLeft: `${(generation - 1) * 20}px` }}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                ref.isActive ? "bg-success" : "bg-muted"
              }`}
            />
            <span className="font-mono text-sm">{shortenAddress(ref.address)}</span>
            <span className="text-xs text-muted">Gen {generation}</span>
            <span className="ml-auto text-sm font-semibold">
              {ref.invested.toLocaleString()} USDT
            </span>
            <span
              className={`badge ${ref.isActive ? "badge-success" : "badge-warning"}`}
            >
              {ref.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {ref.referrals && ref.referrals.length > 0 && (
            <ReferralTree referrals={ref.referrals} generation={generation + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
