interface VLevelBadgeProps {
  level: number;
  smallZone: number;
  nextThreshold?: number;
}

const levelColors: Record<number, string> = {
  0: "from-gray-500 to-gray-600",
  1: "from-green-500 to-green-600",
  2: "from-blue-500 to-blue-600",
  3: "from-purple-500 to-purple-600",
  4: "from-yellow-500 to-yellow-600",
  5: "from-orange-500 to-orange-600",
  6: "from-red-500 to-red-600",
  7: "from-pink-500 to-pink-600",
};

export default function VLevelBadge({ level, smallZone, nextThreshold }: VLevelBadgeProps) {
  const progress = nextThreshold && nextThreshold > 0
    ? Math.min((smallZone / nextThreshold) * 100, 100)
    : 100;

  return (
    <div className="card glow-accent">
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br ${
            levelColors[level] || levelColors[0]
          } flex items-center justify-center text-white text-xl font-bold`}
        >
          V{level}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">
            {level === 0 ? "No Level" : `Level V${level}`}
          </h3>
          <p className="text-sm text-muted">
            Small Zone: {smallZone.toLocaleString()} USDT
          </p>
          {level < 7 && nextThreshold && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Progress to V{level + 1}</span>
                <span className="text-accent">{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-background rounded-full h-2 border border-card-border">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {level === 7 && (
            <span className="badge badge-success mt-2">Max Level</span>
          )}
        </div>
      </div>
    </div>
  );
}
