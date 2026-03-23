import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CapProgressProps {
  earned: number;
  cap: number;
}

export default function CapProgress({ earned, cap }: CapProgressProps) {
  const percentage = cap > 0 ? Math.min((earned / cap) * 100, 100) : 0;
  const isNearCap = percentage >= 80;
  const isCapped = percentage >= 100;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">Cap Progress</span>
        <span className={cn(
          isCapped ? "text-danger" : isNearCap ? "text-warning" : "text-muted"
        )}>
          {earned.toLocaleString()} / {cap.toLocaleString()} USDT ({percentage.toFixed(1)}%)
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
