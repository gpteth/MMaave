"use client";

import { useState } from "react";
import TxButton from "../shared/TxButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InvestFormProps {
  onInvest: (amount: number, referrer: string, passwordHash: string) => Promise<void>;
  isFirstInvestment?: boolean;
}

export default function InvestForm({ onInvest, isFirstInvestment = false }: InvestFormProps) {
  const [amount, setAmount] = useState(100);
  const [referrer, setReferrer] = useState("");

  const adjustAmount = (delta: number) => {
    const newAmount = amount + delta;
    if (newAmount >= 100) setAmount(newAmount);
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Create Investment</h3>

      <div className="mb-4">
        <label className="text-sm text-muted mb-2 block">
          Investment Amount (USDT)
        </label>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => adjustAmount(-100)}
            disabled={amount <= 100}
            className="w-12 h-12 text-xl"
          >
            -
          </Button>
          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              const val = Math.max(100, Math.round(Number(e.target.value) / 100) * 100);
              setAmount(val);
            }}
            min={100}
            step={100}
            className="text-center text-2xl font-bold"
          />
          <Button
            variant="secondary"
            size="icon"
            onClick={() => adjustAmount(100)}
            className="w-12 h-12 text-xl"
          >
            +
          </Button>
        </div>
        <p className="text-xs text-muted mt-2">Minimum: 100 USDT</p>
      </div>

      {/* Quick amount buttons */}
      <div className="flex gap-2 mb-4">
        {[100, 500, 1000, 5000, 10000].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              amount === v
                ? "bg-accent text-white"
                : "bg-background border border-card-border text-muted hover:border-accent"
            )}
          >
            {v.toLocaleString()}
          </button>
        ))}
      </div>

      {isFirstInvestment && (
        <div className="mb-4">
          <label className="text-sm text-muted mb-2 block">
            Referrer Address
          </label>
          <Input
            type="text"
            value={referrer}
            onChange={(e) => setReferrer(e.target.value)}
            placeholder="0x..."
            className="font-mono text-sm"
          />
        </div>
      )}

      <div className="bg-background rounded-lg p-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted">Investment</span>
          <span className="font-semibold">{amount.toLocaleString()} USDT</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Max Return (2.5x)</span>
          <span className="text-accent">{(amount * 2.5).toLocaleString()} USDT</span>
        </div>
      </div>

      <TxButton
        label={`Invest ${amount.toLocaleString()} USDT`}
        onClick={async (passwordHash) => {
          await onInvest(amount, referrer, passwordHash);
        }}
        className="w-full"
      />
    </Card>
  );
}
