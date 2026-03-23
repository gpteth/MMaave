"use client";

import { useState } from "react";
import TxButton from "../shared/TxButton";

interface WithdrawFormProps {
  balance: number;
  feeBps: number;
  minWithdrawal: number;
  onWithdraw: (amount: number, passwordHash: string) => Promise<void>;
}

export default function WithdrawForm({
  balance,
  feeBps,
  minWithdrawal,
  onWithdraw,
}: WithdrawFormProps) {
  const [amount, setAmount] = useState("");

  const numAmount = Number(amount) || 0;
  const feePercent = feeBps / 100;
  const fee = numAmount * (feeBps / 10000);
  const netAmount = numAmount - fee;
  const isValid = numAmount >= minWithdrawal && numAmount <= balance;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Withdraw USDT</h3>

      <div className="mb-4">
        <label className="text-sm text-muted mb-2 block">Amount (USDT)</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Min ${minWithdrawal} USDT`}
            className="input pr-20"
          />
          <button
            onClick={() => setAmount(String(balance))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-accent font-semibold hover:text-accent-light"
          >
            MAX
          </button>
        </div>
        <p className="text-xs text-muted mt-1">
          Available: {balance.toLocaleString()} USDT
        </p>
      </div>

      {numAmount > 0 && (
        <div className="bg-background rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Withdrawal Amount</span>
            <span>{numAmount.toLocaleString()} USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Fee ({feePercent}%)</span>
            <span className="text-danger">-{fee.toFixed(2)} USDT</span>
          </div>
          <div className="border-t border-card-border pt-2 flex justify-between text-sm font-semibold">
            <span>You Receive</span>
            <span className="text-success">{netAmount.toFixed(2)} USDT</span>
          </div>
        </div>
      )}

      <TxButton
        label="Withdraw"
        onClick={async (passwordHash) => {
          await onWithdraw(numAmount, passwordHash);
          setAmount("");
        }}
        disabled={!isValid}
        className="w-full"
      />
    </div>
  );
}
