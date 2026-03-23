"use client";

import TxButton from "../shared/TxButton";

interface LockedBCKCardProps {
  lockedBalance: number;
  dailyRelease: number;
  releasable: number;
  onRelease: (passwordHash: string) => Promise<void>;
}

export default function LockedBCKCard({
  lockedBalance,
  dailyRelease,
  releasable,
  onRelease,
}: LockedBCKCardProps) {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-muted">Locked BCK Tokens</p>
          <p className="text-3xl font-bold mt-1">
            {lockedBalance.toLocaleString()}{" "}
            <span className="text-lg text-muted">BCK</span>
          </p>
        </div>
        <span className="text-3xl">🔒</span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="bg-background rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-muted">Daily Release (1%)</span>
          <span className="text-sm font-semibold">{dailyRelease.toFixed(4)} BCK</span>
        </div>
        <div className="bg-background rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-muted">Available to Claim</span>
          <span className="text-sm text-success font-semibold">
            {releasable.toFixed(4)} BCK
          </span>
        </div>
      </div>

      {releasable > 0 && (
        <TxButton
          label={`Claim ${releasable.toFixed(4)} BCK`}
          onClick={onRelease}
          className="w-full"
        />
      )}
    </div>
  );
}
