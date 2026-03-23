"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LanguageSwitcher from "../shared/LanguageSwitcher";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Coins,
  Users,
  TrendingUp,
  Menu,
  RefreshCw,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/invest", labelKey: "nav.invest", icon: Coins },
  { href: "/team", labelKey: "nav.team", icon: Users },
  { href: "/financials", labelKey: "nav.financials", icon: TrendingUp },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-md border-t border-card-border shadow-[0_-10px_30px_rgba(0,0,0,0.22)] flex justify-around items-center h-14 md:hidden z-50 safe-area-bottom">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 text-[11px] py-1",
                isActive ? "text-accent" : "text-foreground/60"
              )}
            >
              <Icon className="w-5 h-5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cn(
            "flex flex-col items-center gap-1 text-[11px] py-1 transition-colors",
            open ? "text-accent" : "text-foreground/60"
          )}
        >
          <Menu className="w-5 h-5" />
          {t("nav.more")}
        </button>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute bottom-14 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-card-border p-4 space-y-2 rounded-t-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.35)] transition-transform duration-200",
            open ? "translate-y-0" : "translate-y-2"
          )}
        >
          {[
            { href: "/restart", labelKey: "nav.restart", icon: RefreshCw },
            { href: "/admin", labelKey: "nav.admin", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-foreground/70 hover:text-foreground hover:bg-background/50 transition-colors"
              >
                <Icon className="w-4 h-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
          <div className="sm:hidden px-4 pt-2 border-t border-card-border">
            <p className="text-xs text-muted mb-2">{t("header.bscMainnet")}</p>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}
