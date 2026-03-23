"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { Badge } from "@/components/ui/badge";

type Status = "active" | "inactive" | "frozen" | "paused";

const statusConfig: Record<Status, { labelKey: string; variant: "success" | "warning" | "danger" }> = {
  active: { labelKey: "common.active", variant: "success" },
  inactive: { labelKey: "common.inactive", variant: "warning" },
  frozen: { labelKey: "common.frozen", variant: "danger" },
  paused: { labelKey: "common.paused", variant: "warning" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { t } = useLanguage();
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{t(config.labelKey)}</Badge>;
}
