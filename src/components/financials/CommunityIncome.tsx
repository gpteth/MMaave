interface CommunityIncomeEntry {
  date: string;
  source: string;
  tier: number;
  amount: number;
}

interface CommunityIncomeProps {
  entries: CommunityIncomeEntry[];
  totalEarned: number;
}

export default function CommunityIncome({ entries, totalEarned }: CommunityIncomeProps) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Community Income History</h3>
        <div className="text-right">
          <p className="text-xs text-muted">Total Earned</p>
          <p className="text-lg font-bold text-success">{totalEarned.toLocaleString()} USDT</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-muted py-8">No community income records</p>
      ) : (
        <div className="bg-background rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left p-3 text-muted">Date</th>
                <th className="text-left p-3 text-muted">Source</th>
                <th className="text-center p-3 text-muted">Tier</th>
                <th className="text-right p-3 text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="p-3 text-muted">{entry.date}</td>
                  <td className="p-3 font-mono text-xs">{entry.source}</td>
                  <td className="p-3 text-center">
                    <span className="badge badge-success">T{entry.tier}</span>
                  </td>
                  <td className="p-3 text-right font-semibold text-success">
                    +{entry.amount.toFixed(2)} USDT
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted mt-3">
        Records older than 20 days are automatically cleared.
      </p>
    </div>
  );
}
