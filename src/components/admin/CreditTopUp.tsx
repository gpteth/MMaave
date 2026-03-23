"use client";

import { useState } from "react";

interface CreditTopUpProps {
  onTopUp: (address: string, amount: number) => Promise<void>;
}

export default function CreditTopUp({ onTopUp }: CreditTopUpProps) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !amount) return;
    setLoading(true);
    setSuccess(false);
    try {
      await onTopUp(address, Number(amount));
      setSuccess(true);
      setAddress("");
      setAmount("");
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Credit Top-Up (Testing)</h3>
      <p className="text-sm text-muted mb-4">
        Add USDT balance to a member account for testing purposes.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-muted mb-2 block">Member Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className="input font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-muted mb-2 block">Amount (USDT)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="input"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !address || !amount}
          className="btn-primary w-full"
        >
          {loading ? "Processing..." : "Top Up"}
        </button>
        {success && (
          <p className="text-success text-sm text-center">Top-up successful!</p>
        )}
      </form>
    </div>
  );
}
