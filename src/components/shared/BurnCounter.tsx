"use client";

import { formatNumber } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Flame } from "lucide-react";

export default function BurnCounter() {
  const { t } = useLanguage();
  const totalBurned = "0";

  return (
    <div className="flex items-center gap-2 text-sm">
      <Flame className="w-4 h-4 text-warning" />
      <span className="text-muted">{t("header.totalBurned")}</span>
      <span className="font-semibold text-warning">
        {formatNumber(totalBurned, 0)}
      </span>
    </div>
  );
}
