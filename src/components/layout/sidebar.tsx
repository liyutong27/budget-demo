"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  CheckSquare,
  FileText,
  DollarSign,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/budget", label: "Budgets", icon: Wallet },
  { href: "/close", label: "Month-End Close", icon: CheckSquare },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-slate-900 text-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-700 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#26a17b]">
          <DollarSign className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-none">Budget</h1>
          <p className="text-[10px] text-slate-400">USDT Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-slate-700/80 text-white font-medium"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 px-4 py-3">
        <p className="text-[10px] text-slate-500">Crypto Startup Inc.</p>
        <p className="text-[10px] text-slate-500">v1.0 - All amounts in USDT</p>
      </div>
    </aside>
  );
}
