"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUSDT, formatPercent, formatDate, formatCompactNumber } from "@/lib/format";
import {
  getMonthsForPeriod,
  getPreviousPeriod,
  getCompanySpendBreakdown,
  getCompanyBudgetTotals,
  calculateGEBudgetRows,
  getMonthlyHCGETrend,
  generateGEAlerts,
  calculateDeptGEChanges,
  getCategoryChanges,
  generateInsights,
  detectFlaggedTransactions,
} from "@/lib/calculations";
import { MONTHS, MONTH_LABELS, DEPARTMENT_MAP, QUARTER_LIST, QUARTER_LABELS } from "@/lib/constants";
import { Month, Quarter, TimePeriodMode, ActualsData, BudgetsData, Transaction } from "@/lib/types";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
import treasuryData from "@/data/treasury.json";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Users,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Lightbulb,
  CheckCircle,
  Info,
} from "lucide-react";

const budgets = budgetsData as BudgetsData;
const actuals = actualsData as ActualsData;
const transactions = transactionsData as Transaction[];

const darkTooltipStyle = {
  backgroundColor: "#0f0f22",
  border: "1px solid #1e1e3a",
  borderRadius: "8px",
  color: "#e8e8ff",
};

// ─── Helper: period label for "vs" text ─────────────────────
function periodLabel(mode: TimePeriodMode, value: string): string {
  if (mode === "month") return MONTH_LABELS[value as Month] ?? value;
  if (mode === "quarter") return QUARTER_LABELS[value as Quarter] ?? value;
  return "YTD";
}

// ─── Main Page ───────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [periodMode, setPeriodMode] = useState<TimePeriodMode>("month");
  const [monthValue, setMonthValue] = useState<Month>("feb-2026");
  const [quarterValue, setQuarterValue] = useState<Quarter>("Q1-2026");

  const periodValue = periodMode === "month" ? monthValue : periodMode === "quarter" ? quarterValue : "ytd";

  // ── Compute months and previous period ───
  const currentMonths = useMemo(() => getMonthsForPeriod(periodMode, periodValue), [periodMode, periodValue]);
  const prevPeriod = useMemo(() => getPreviousPeriod(periodMode, periodValue), [periodMode, periodValue]);
  const prevMonths = useMemo(
    () => (prevPeriod ? getMonthsForPeriod(prevPeriod.mode, prevPeriod.value) : []),
    [prevPeriod]
  );

  // ── Spend breakdowns ───
  const currentSpend = useMemo(() => getCompanySpendBreakdown(actuals, currentMonths), [currentMonths]);
  const prevSpend = useMemo(
    () => (prevMonths.length > 0 ? getCompanySpendBreakdown(actuals, prevMonths) : null),
    [prevMonths]
  );

  const totalChange = prevSpend ? ((currentSpend.total - prevSpend.total) / prevSpend.total) * 100 : 0;
  const geChange = prevSpend && prevSpend.generalExpense > 0
    ? ((currentSpend.generalExpense - prevSpend.generalExpense) / prevSpend.generalExpense) * 100
    : 0;
  const hcChange = prevSpend && prevSpend.humanCapital > 0
    ? ((currentSpend.humanCapital - prevSpend.humanCapital) / prevSpend.humanCapital) * 100
    : 0;

  // ── GE utilization ───
  const budgetTotals = useMemo(() => getCompanyBudgetTotals(budgets, currentMonths), [currentMonths]);
  const geUtilization = budgetTotals.ge > 0 ? (currentSpend.generalExpense / budgetTotals.ge) * 100 : 0;

  // ── GE budget rows ───
  const geBudgetRows = useMemo(() => calculateGEBudgetRows(budgets, actuals, currentMonths), [currentMonths]);

  // ── Trend data ───
  const trendData = useMemo(() => getMonthlyHCGETrend(budgets, actuals, MONTHS), []);

  // ── Alerts ───
  const alerts = useMemo(
    () => generateGEAlerts(budgets, actuals, transactions, currentMonths),
    [currentMonths]
  );

  const monthSet = useMemo(() => new Set(currentMonths as string[]), [currentMonths]);

  // ── Smart flagged transactions detection ───
  const flaggedItems = useMemo(
    () => detectFlaggedTransactions(transactions, actuals, currentMonths),
    [currentMonths]
  );
  const flaggedCount = flaggedItems.length;

  // ── Runway calculation ───
  const runway = useMemo(() => {
    const balances = treasuryData.balances as Record<string, number>;
    // Use the latest available month's balance
    const latestMonth = [...MONTHS].reverse().find((m) => balances[m] != null);
    const treasuryBalance = latestMonth ? balances[latestMonth] : 0;

    // Average monthly burn from the last 3 months with data
    const monthsWithExpenses = [...MONTHS]
      .reverse()
      .map((m) => currentSpend.total > 0 ? m : null)
      .filter(Boolean);

    // Use P&L totalExpenses for burn rate (all months)
    const recentMonths = MONTHS.filter((m) => {
      const spend = getCompanySpendBreakdown(actuals, [m]);
      return spend.total > 0;
    }).slice(-3);
    const totalBurn = recentMonths.reduce((sum, m) => sum + getCompanySpendBreakdown(actuals, [m]).total, 0);
    const avgMonthlyBurn = recentMonths.length > 0 ? totalBurn / recentMonths.length : 0;
    const runwayMonths = avgMonthlyBurn > 0 ? treasuryBalance / avgMonthlyBurn : 0;

    return { treasuryBalance, avgMonthlyBurn, runwayMonths };
  }, []);

  // ── Top GE Transactions ───
  const topGETransactions = useMemo(() => {
    return transactions
      .filter((t) => t.type === "general-expense" && monthSet.has(t.month))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [monthSet]);

  // ── Department GE changes vs previous period ───
  const deptGEChanges = useMemo(
    () => (prevMonths.length > 0 ? calculateDeptGEChanges(actuals, currentMonths, prevMonths) : []),
    [currentMonths, prevMonths]
  );

  // ── Category changes vs previous period ───
  const categoryChanges = useMemo(
    () => (prevMonths.length > 0 ? getCategoryChanges(transactions, currentMonths, prevMonths) : []),
    [currentMonths, prevMonths]
  );

  // ── AI insights ───
  const insights = useMemo(
    () => generateInsights(budgets, actuals, transactions, currentMonths, prevMonths),
    [currentMonths, prevMonths]
  );

  // ── Previous period label ───
  const prevLabel = prevPeriod ? periodLabel(prevPeriod.mode, prevPeriod.value) : null;

  return (
    <div>
      {/* ── Header + Time Period Selector ── */}
      <div className="flex items-start justify-between pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#e8e8ff]">Dashboard</h1>
          <p className="text-sm text-[#6b6b9a] mt-1">Spend overview</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-[#1e1e3a] bg-[#0a0a1a] p-0.5">
              {(["month", "quarter", "ytd"] as TimePeriodMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPeriodMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    periodMode === mode
                      ? "bg-[#9997FF] text-white shadow-sm"
                      : "text-[#6b6b9a] hover:text-[#e8e8ff]"
                  }`}
                >
                  {mode === "month" ? "Month" : mode === "quarter" ? "Quarter" : "YTD"}
                </button>
              ))}
            </div>

            {/* Value Selector */}
            {periodMode === "month" && (
              <Select value={monthValue} onValueChange={(v) => setMonthValue(v as Month)}>
                <SelectTrigger className="w-36 h-9 text-xs bg-[#0a0a1a] border-[#1e1e3a]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{MONTH_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {periodMode === "quarter" && (
              <Select value={quarterValue} onValueChange={(v) => setQuarterValue(v as Quarter)}>
                <SelectTrigger className="w-36 h-9 text-xs bg-[#0a0a1a] border-[#1e1e3a]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTER_LIST.map((q) => (
                    <SelectItem key={q} value={q}>{QUARTER_LABELS[q]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {prevLabel && (
            <span className="text-[11px] text-[#5a5a80]">vs {prevLabel}</span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {/* Total Spend */}
        <Card
          className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22] cursor-pointer hover:border-[#2e2e4a] transition-colors"
          onClick={() => router.push("/budget")}
        >
          <CardContent className="p-5">
            <span className="text-[11px] uppercase tracking-wider text-[#6b6b9a] font-medium">Total Spend</span>
            <p className="text-3xl font-bold text-[#e8e8ff] tracking-tight mt-2">
              {formatUSDT(currentSpend.total, true)}
            </p>
            {prevSpend && (
              <DeltaBadge value={totalChange} label={`vs ${prevLabel}`} />
            )}
          </CardContent>
        </Card>

        {/* GE Spend + Utilization */}
        <Card
          className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22] cursor-pointer hover:border-[#2e2e4a] transition-colors"
          onClick={() => router.push("/budget")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#6b6b9a] font-medium">GE Spend</span>
              <span className={`text-[11px] font-mono font-semibold ${
                geUtilization > 100 ? "text-[#ff6b6b]" : geUtilization > 85 ? "text-[#ffb86c]" : "text-[#9997FF]"
              }`}>
                {geUtilization.toFixed(0)}% used
              </span>
            </div>
            <p className="text-3xl font-bold text-[#e8e8ff] tracking-tight mt-2">
              {formatUSDT(currentSpend.generalExpense, true)}
            </p>
            {prevSpend && (
              <DeltaBadge value={geChange} label={`vs ${prevLabel}`} />
            )}
            <div className="mt-1.5">
              <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(geUtilization, 100)}%`,
                    backgroundColor: geUtilization > 100 ? "#ff6b6b" : geUtilization > 85 ? "#ffb86c" : "#9997FF",
                  }}
                />
              </div>
              <p className="text-[10px] text-[#5a5a80] mt-1">
                of {formatUSDT(budgetTotals.ge, true)} budget
              </p>
            </div>
          </CardContent>
        </Card>

        {/* HC Spend */}
        <Card
          className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22] cursor-pointer hover:border-[#2e2e4a] transition-colors"
          onClick={() => router.push("/budget?tab=hc")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#6b6b9a] font-medium">HC Spend</span>
              <div className="bg-[rgba(67,124,255,0.12)] text-[#437CFF] p-1 rounded-md">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-[#e8e8ff] tracking-tight mt-2">
              {formatUSDT(currentSpend.humanCapital, true)}
            </p>
            {prevSpend && (
              <DeltaBadge value={hcChange} label={`vs ${prevLabel}`} />
            )}
          </CardContent>
        </Card>

        {/* Flagged */}
        <Card
          className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22] cursor-pointer hover:border-[#2e2e4a] transition-colors"
          onClick={() => {
            if (flaggedItems.length > 0) {
              const first = flaggedItems[0].transaction;
              router.push(`/budget?dept=${first.department}&highlight=${first.id}`);
            } else {
              router.push("/budget");
            }
          }}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#6b6b9a] font-medium">Flagged</span>
              <div className={`p-1 rounded-md ${flaggedCount > 0 ? "bg-[rgba(255,107,107,0.12)] text-[#ff6b6b]" : "bg-[rgba(80,250,123,0.12)] text-[#50fa7b]"}`}>
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-[#e8e8ff] tracking-tight mt-2">
              {flaggedCount}
            </p>
            {flaggedCount > 0 ? (
              <div className="mt-2 space-y-1">
                {flaggedItems.slice(0, 2).map((f) => (
                  <p key={f.transaction.id} className="text-[10px] text-[#ff6b6b] truncate">
                    {f.transaction.description.slice(0, 20)}… ${f.transaction.amount.toLocaleString()}
                  </p>
                ))}
                {flaggedCount > 2 && (
                  <p className="text-[10px] text-[#5a5a80]">+{flaggedCount - 2} more</p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-[#5a5a80] mt-2">All clear</p>
            )}
          </CardContent>
        </Card>

        {/* Runway */}
        {(() => {
          const TARGET_YEARS = 4.5;
          const TARGET_MONTHS = TARGET_YEARS * 12;
          const runwayYears = runway.runwayMonths / 12;
          const onTrack = runway.runwayMonths >= TARGET_MONTHS;
          return (
            <Card className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#6b6b9a] font-medium">Runway</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    onTrack
                      ? "bg-[rgba(80,250,123,0.12)] text-[#50fa7b]"
                      : "bg-[rgba(255,184,108,0.12)] text-[#ffb86c]"
                  }`}>
                    {onTrack ? "On Track" : "Behind Target"}
                  </span>
                </div>
                <p className="text-3xl font-bold text-[#e8e8ff] tracking-tight mt-2">
                  {runwayYears.toFixed(1)}<span className="text-lg text-[#6b6b9a] ml-1">yr</span>
                  <span className="text-sm text-[#5a5a80] font-normal ml-1">/ {TARGET_YEARS}yr</span>
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#6b6b9a]">Treasury</span>
                    <span className="font-mono text-[#e8e8ff]">{formatUSDT(runway.treasuryBalance, true)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#6b6b9a]">Monthly Burn</span>
                    <span className="font-mono text-[#e8e8ff]">{formatUSDT(runway.avgMonthlyBurn, true)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* ── Main Chart Area (2/3 + 1/3) ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Spend Trend: HC & GE Stacked Area */}
        <Card className="col-span-2 rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#6b6b9a]">Spend Trend &mdash; Headcount &amp; General Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradHC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#437CFF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#437CFF" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradGE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9997FF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#9997FF" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#6b6b9a" }}
                  tickFormatter={(v) => (MONTH_LABELS[v as Month] ?? String(v)).slice(0, 3)}
                  stroke="#1e1e3a"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b6b9a" }}
                  tickFormatter={(v) => `$${formatCompactNumber(Number(v))}`}
                  stroke="#1e1e3a"
                />
                <Tooltip
                  formatter={(v, name) => [
                    formatUSDT(Number(v), true),
                    name === "hc" ? "HC" : name === "ge" ? "GE" : name === "geBudget" ? "GE Budget" : String(name),
                  ]}
                  labelFormatter={(l) => MONTH_LABELS[l as Month] || l}
                  contentStyle={darkTooltipStyle}
                  labelStyle={{ color: "#6b6b9a" }}
                  itemStyle={{ color: "#e8e8ff" }}
                />
                <Legend
                  wrapperStyle={{ color: "#6b6b9a", fontSize: 11 }}
                  formatter={(value: string) =>
                    value === "hc" ? "HC (Human Capital)" : value === "ge" ? "GE (General Expense)" : value === "geBudget" ? "GE Budget" : value
                  }
                />
                <Area
                  type="monotone"
                  dataKey="hc"
                  stackId="spend"
                  stroke="#437CFF"
                  fill="url(#gradHC)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="ge"
                  stackId="spend"
                  stroke="#9997FF"
                  fill="url(#gradGE)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="geBudget"
                  stroke="#ff6b6b"
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* GE Budget by Department */}
        <Card className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#6b6b9a]">General Expense by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {geBudgetRows
                .filter((r) => r.geBudget > 0 || r.geActual > 0)
                .map((row) => {
                  const pct = row.geUtilization;
                  const statusColor = pct > 100 ? "#ff6b6b" : pct > 85 ? "#ffb86c" : "#50fa7b";
                  const statusLabel = pct > 100 ? "Over" : pct > 85 ? "Warning" : "On Track";
                  return (
                    <div
                      key={row.departmentId}
                      className="border-b border-[#1e1e3a] pb-3 last:border-0 cursor-pointer hover:bg-[rgba(153,151,255,0.04)] rounded-lg px-1 -mx-1 transition-colors"
                      onClick={() => router.push(`/budget?dept=${row.departmentId}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                          <span className="text-xs font-medium text-[#e8e8ff]">{row.departmentName}</span>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            color: statusColor,
                            backgroundColor: `${statusColor}18`,
                          }}
                        >
                          {statusLabel} {pct > 100 && "\u26A0\uFE0F"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6b6b9a] mb-1.5">
                        <span>
                          {formatUSDT(row.geActual, true)} / {formatUSDT(row.geBudget, true)}
                        </span>
                        <span className="font-mono">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: statusColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Period Changes + AI Insights ── */}
      {prevMonths.length > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          {/* Period Changes */}
          <Card className="col-span-3 rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b9a] flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-[#9997FF]" />
                Changes vs {prevLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Department GE Changes */}
                <div>
                  <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-2 font-medium">Department GE</p>
                  <div className="space-y-2">
                    {deptGEChanges.filter((d) => d.prevGE > 0 || d.currentGE > 0).map((d) => (
                      <div key={d.departmentId} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          <span className="text-[#e8e8ff]">{d.departmentName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#6b6b9a] text-[11px]">
                            {formatUSDT(d.prevGE, true)} → {formatUSDT(d.currentGE, true)}
                          </span>
                          <span className={`font-mono text-[11px] font-medium min-w-[50px] text-right ${
                            d.change > 0 ? "text-[#ff6b6b]" : d.change < 0 ? "text-[#50fa7b]" : "text-[#5a5a80]"
                          }`}>
                            {d.change > 0 ? "+" : ""}{formatPercent(d.changePct, false)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Category Changes */}
                <div>
                  <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-2 font-medium">Top Category Changes</p>
                  <div className="space-y-2">
                    {categoryChanges.slice(0, 6).map((c) => (
                      <div key={c.category} className="flex items-center justify-between text-xs">
                        <span className="text-[#e8e8ff] truncate max-w-[120px]">{c.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#6b6b9a] text-[11px]">
                            {formatUSDT(c.current, true)}
                          </span>
                          <span className={`font-mono text-[11px] font-medium min-w-[60px] text-right ${
                            c.change > 0 ? "text-[#ff6b6b]" : c.change < 0 ? "text-[#50fa7b]" : "text-[#5a5a80]"
                          }`}>
                            {c.change > 0 ? "+" : ""}{formatUSDT(c.change, true)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className="col-span-2 rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b9a] flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#9997FF]" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className={`mt-0.5 shrink-0 p-0.5 rounded ${
                      insight.type === "warning"
                        ? "text-[#ffb86c]"
                        : insight.type === "success"
                        ? "text-[#50fa7b]"
                        : insight.type === "optimization"
                        ? "text-[#9997FF]"
                        : "text-[#6b6b9a]"
                    }`}>
                      {insight.type === "warning" && <AlertTriangle className="h-3 w-3" />}
                      {insight.type === "success" && <CheckCircle className="h-3 w-3" />}
                      {insight.type === "optimization" && <Lightbulb className="h-3 w-3" />}
                      {insight.type === "info" && <Info className="h-3 w-3" />}
                    </div>
                    <p className="text-[#e8e8ff] leading-relaxed">{insight.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Bottom Section (3/5 + 2/5) ── */}
      <div className="grid grid-cols-5 gap-4">
        {/* Top GE Transactions */}
        <Card className="col-span-3 rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#6b6b9a]">
              Top General Expense Transactions
              <span className="ml-2 text-[10px] text-[#5a5a80] font-normal">
                {periodMode === "month"
                  ? MONTH_LABELS[monthValue]
                  : periodMode === "quarter"
                  ? QUARTER_LABELS[quarterValue]
                  : "Year to Date"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e3a] text-[10px] text-[#5a5a80] uppercase tracking-wider">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-left py-2 font-medium">Dept</th>
                    <th className="text-left py-2 font-medium">Applicant</th>
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                    <th className="text-left py-2 font-medium pl-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topGETransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-[#5a5a80] text-xs">
                        No GE transactions for this period
                      </td>
                    </tr>
                  )}
                  {topGETransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-[#1e1e3a] last:border-0 hover:bg-[rgba(153,151,255,0.04)] cursor-pointer transition-colors"
                      onClick={() => router.push(`/budget?dept=${txn.department}`)}
                    >
                      <td className="py-2.5 text-[11px] text-[#6b6b9a]">{formatDate(txn.date)}</td>
                      <td className="py-2.5 text-[11px] text-[#e8e8ff]">
                        {DEPARTMENT_MAP[txn.department]?.name ?? txn.department}
                      </td>
                      <td className="py-2.5 text-[11px] text-[#6b6b9a]">{txn.applicant}</td>
                      <td className="py-2.5 text-[11px] max-w-[180px] truncate text-[#e8e8ff]">
                        {txn.description}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[11px] text-[#e8e8ff]">
                        {formatUSDT(txn.amount)}
                      </td>
                      <td className="py-2.5 pl-3">
                        <Badge
                          variant={txn.flagged ? "destructive" : "secondary"}
                          className={`text-[9px] ${
                            txn.flagged
                              ? "bg-[rgba(255,107,107,0.12)] text-[#ff6b6b] border-[rgba(255,107,107,0.2)] hover:bg-[rgba(255,107,107,0.18)]"
                              : "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF] border-[#1e1e3a] hover:bg-[rgba(153,151,255,0.18)]"
                          }`}
                        >
                          {txn.flagged ? "flagged" : txn.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="col-span-2 rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#6b6b9a]">Alerts</CardTitle>
              {alerts.length > 0 && (
                <span className="text-[10px] font-semibold bg-[rgba(255,107,107,0.12)] text-[#ff6b6b] px-2 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {alerts.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-[#5a5a80]">No alerts</p>
                  <p className="text-[11px] text-[#3a3a5a] mt-1">All departments within budget</p>
                </div>
              )}
              {alerts.map((alert) => {
                // Enrich flagged alerts with reason from smart detection
                const flaggedItem = alert.type === "flagged_transaction"
                  ? flaggedItems.find((f) => f.transaction.id === alert.transactionId)
                  : null;
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[#1e1e3a] cursor-pointer hover:border-[#2e2e4a] transition-colors"
                    onClick={() => {
                      if (alert.type === "flagged_transaction" && alert.transactionId) {
                        router.push(`/budget?dept=${alert.departmentId}&highlight=${alert.transactionId}`);
                      } else {
                        router.push(`/budget?dept=${alert.departmentId}`);
                      }
                    }}
                  >
                    <div
                      className={`mt-0.5 shrink-0 p-1 rounded ${
                        alert.severity === "high"
                          ? "bg-[rgba(255,107,107,0.12)] text-[#ff6b6b]"
                          : "bg-[rgba(255,184,108,0.12)] text-[#ffb86c]"
                      }`}
                    >
                      {alert.type === "flagged_transaction" ? (
                        <ShieldAlert className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#e8e8ff] truncate">{alert.title}</p>
                      <p className="text-[11px] text-[#6b6b9a] mt-0.5">{alert.description}</p>
                      {flaggedItem && (
                        <p className="text-[10px] text-[#ffb86c] mt-1">{flaggedItem.reasons[0]}</p>
                      )}
                      {alert.type === "over_budget" && (
                        <p className="text-[10px] text-[#5a5a80] mt-1">Click to view department GE breakdown</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`ml-auto shrink-0 text-[9px] ${
                        alert.severity === "high"
                          ? "bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] border-[rgba(255,107,107,0.2)]"
                          : "bg-[rgba(255,184,108,0.08)] text-[#ffb86c] border-[rgba(255,184,108,0.2)]"
                      }`}
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Delta Badge Component ───────────────────────────────────
function DeltaBadge({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isZero = Math.abs(value) < 0.05;
  return (
    <p className="text-xs text-[#6b6b9a] mt-2 flex items-center gap-1">
      {!isZero && (
        isPositive ? (
          <ArrowUpRight className="h-3 w-3 text-[#ff6b6b]" />
        ) : (
          <ArrowDownRight className="h-3 w-3 text-[#50fa7b]" />
        )
      )}
      <span className={isZero ? "text-[#5a5a80]" : isPositive ? "text-[#ff6b6b]" : "text-[#50fa7b]"}>
        {formatPercent(value)}
      </span>
      <span className="text-[#5a5a80]">{label}</span>
    </p>
  );
}
