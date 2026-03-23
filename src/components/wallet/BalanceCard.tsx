interface BalanceCardProps {
  balance: number;
  pendingRelease: number;
}

export default function BalanceCard({ balance, pendingRelease }: BalanceCardProps) {
  return (
    <div className="card glow-accent">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-muted">Available Balance</p>
          <p className="text-3xl font-bold mt-1">{balance.toLocaleString()} <span className="text-lg text-muted">USDT</span></p>
        </div>
        <span className="text-3xl">💰</span>
      </div>
      {pendingRelease > 0 && (
        <div className="bg-background rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-muted">Pending Release</span>
          <span className="text-sm text-success font-semibold">+{pendingRelease.toFixed(2)} USDT</span>
        </div>
      )}
    </div>
  );
}
