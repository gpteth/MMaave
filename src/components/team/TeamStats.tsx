interface TeamStatsProps {
  directReferrals: number;
  generationsUnlocked: number;
  totalTeamSize: number;
  largeZone: number;
  smallZone: number;
  totalPerformance: number;
}

export default function TeamStats({
  directReferrals,
  generationsUnlocked,
  totalTeamSize,
  largeZone,
  smallZone,
  totalPerformance,
}: TeamStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="card text-center">
        <p className="text-2xl font-bold text-accent">{directReferrals}</p>
        <p className="text-xs text-muted mt-1">Direct Referrals</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold text-success">{generationsUnlocked}/3</p>
        <p className="text-xs text-muted mt-1">Generations Unlocked</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold">{totalTeamSize}</p>
        <p className="text-xs text-muted mt-1">Team Size</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold text-warning">{largeZone.toLocaleString()}</p>
        <p className="text-xs text-muted mt-1">Large Zone (USDT)</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold text-accent">{smallZone.toLocaleString()}</p>
        <p className="text-xs text-muted mt-1">Small Zone (USDT)</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold">{totalPerformance.toLocaleString()}</p>
        <p className="text-xs text-muted mt-1">Total Performance (USDT)</p>
      </div>
    </div>
  );
}
