"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeb3 } from "@/contexts/Web3Context";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useAdminActions } from "@/hooks/useAdminActions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Coins,
  Users,
  TrendingUp,
  RefreshCw,
  Settings,
  ClipboardList,
  Wrench,
  SlidersHorizontal,
  Calculator,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/invest", labelKey: "nav.invest", icon: Coins },
  { href: "/team", labelKey: "nav.team", icon: Users },
  { href: "/financials", labelKey: "nav.financials", icon: TrendingUp },
  { href: "/restart", labelKey: "nav.restart", icon: RefreshCw },
];

const adminItems = [
  { href: "/admin", labelKey: "nav.admin", icon: Settings },
  { href: "/admin/members", labelKey: "nav.members", icon: ClipboardList },
  { href: "/admin/settlement", labelKey: "nav.settlement", icon: Calculator },
  { href: "/admin/config", labelKey: "nav.config", icon: SlidersHorizontal },
  { href: "/admin/operations", labelKey: "nav.operations", icon: Wrench },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { address } = useWeb3();
  const { t } = useLanguage();
  const { isAdmin, isOwner } = useAdminActions(address ?? undefined);

  const showAdmin = isAdmin || isOwner;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface/80 backdrop-blur-md border-r border-card-border shadow-[10px_0_30px_rgba(0,0,0,0.22)] flex flex-col z-40">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">Rockplan</h1>
        <p className="text-xs text-muted mt-1">DeFi Investment Platform</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-accent/10 text-accent border border-accent/20 shadow-[0_0_0_1px_rgba(247,147,26,0.06)]"
                  : "text-foreground/60 hover:text-foreground hover:bg-background/40 hover:-translate-y-px"
              )}
            >
              <Icon className="w-4 h-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}

        {showAdmin && (
          <>
            <div className="pt-4 pb-2 px-4">
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                {t("common.admin")}
              </p>
            </div>
            {adminItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-accent/10 text-accent border border-accent/20 shadow-[0_0_0_1px_rgba(247,147,26,0.06)]"
                      : "text-foreground/60 hover:text-foreground hover:bg-background/40 hover:-translate-y-px"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-card-border">
        <div className="text-xs text-muted text-center">
          {t("common.poweredBy")}
        </div>
      </div>
    </aside>
  );
}
