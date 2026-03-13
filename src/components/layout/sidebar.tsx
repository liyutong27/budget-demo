"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  CheckSquare,
  FileText,
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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-[#1e1e3a] bg-[#0a0a1e]">
      <div className="flex h-14 items-center gap-3 border-b border-[#1e1e3a] px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9997FF]">
          <span className="text-sm font-bold text-white">D</span>
        </div>
        <div>
          <h1 className="text-sm font-bold leading-none text-[#ACAAFF]">Donut</h1>
          <p className="text-[10px] text-[#5a5a80]">Budget Dashboard</p>
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
                  ? "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF] font-medium"
                  : "text-[#6b6b9a] hover:bg-[rgba(153,151,255,0.06)] hover:text-[#ACAAFF]"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#1e1e3a] px-4 py-3">
        <p className="text-[10px] text-[#5a5a80]">Donut Protocol</p>
        <p className="text-[10px] text-[#5a5a80]">All amounts in USDT</p>
      </div>
    </aside>
  );
}
