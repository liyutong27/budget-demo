"use client";

import { useMemo, useState } from "react";
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
} from "@/lib/calculations";
import { MONTHS, MONTH_LABELS, DEPARTMENT_MAP, QUARTER_LIST, QUARTER_LABELS } from "@/lib/constants";
import { Month, Quarter, TimePeriodMode, ActualsData, BudgetsData, Transaction } from "@/lib/types";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
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
  DollarSign,
  Users,
  ShieldAlert,
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

  // ── Flagged count ───
  const monthSet = useMemo(() => new Set(currentMonths as string[]), [currentMonths]);
  const flaggedCount = useMemo(
    () => transactions.filter((t) => t.flagged && monthSet.has(t.month)).length,
    [monthSet]
  );

  // ── Top GE Transactions ───
  const topGETransactions = useMemo(() => {
    return transactions
      .filter((t) => t.type === "general-expense" && monthSet.has(t.month))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [monthSet]);

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
        <Card className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
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

        {/* GE Spend */}
        <Card className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#6b6b9a] font-medium">GE Spend</span>
              <div className="bg-[rgba(153,151,255,0.12)] text-[#9997FF] p-1 rounded-md">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-[#e8e8ff] tracking-tight mt-2">
              {formatUSDT(currentSpend.generalExpense, true)}
            </p>
            {prevSpend && (
              <DeltaBadge value={geChange} label={`vs ${prevLabel}`} />
            )}
          </CardContent>
        </Card>

        {/* HC Spend */}
        <Card className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
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

        {/* GE Utilization */}
        <Card className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardContent className="p-5">
            <span className="text-[11px] uppercase tracking-wider text-[#6b6b9a] font-medium">GE Utilization</span>
            <p className="text-3xl font-bold text-[#e8e8ff] tracking-tight mt-2">
              {geUtilization.toFixed(0)}%
            </p>
            <div className="mt-2">
              <div className="w-full h-2 bg-[#1e1e3a] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(geUtilization, 100)}%`,
                    backgroundColor: geUtilization > 100 ? "#ff6b6b" : geUtilization > 85 ? "#ffb86c" : "#9997FF",
                  }}
                />
              </div>
              <p className="text-[10px] text-[#5a5a80] mt-1">
                {formatUSDT(currentSpend.generalExpense, true)} of {formatUSDT(budgetTotals.ge, true)} budget
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Flagged */}
        <Card className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
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
            <p className="text-[10px] text-[#5a5a80] mt-2">
              {flaggedCount > 0 ? "Requires review" : "All clear"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Chart Area (2/3 + 1/3) ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Spend Trend: HC & GE Stacked Area */}
        <Card className="col-span-2 rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#6b6b9a]">Spend Trend &mdash; HC &amp; GE</CardTitle>
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
            <CardTitle className="text-sm font-medium text-[#6b6b9a]">GE Budget by Department</CardTitle>
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
                    <div key={row.departmentId} className="border-b border-[#1e1e3a] pb-3 last:border-0">
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

      {/* ── Bottom Section (3/5 + 2/5) ── */}
      <div className="grid grid-cols-5 gap-4">
        {/* Top GE Transactions */}
        <Card className="col-span-3 rounded-xl border border-[#1e1e3a] bg-[#0f0f22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#6b6b9a]">
              Top GE Transactions
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
                      className="border-b border-[#1e1e3a] last:border-0 hover:bg-[rgba(153,151,255,0.04)]"
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
              <CardTitle className="text-sm font-medium text-[#6b6b9a]">GE Alerts</CardTitle>
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
                  <p className="text-[11px] text-[#3a3a5a] mt-1">All departments within GE budget</p>
                </div>
              )}
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[#1e1e3a]"
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
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#e8e8ff] truncate">{alert.title}</p>
                    <p className="text-[11px] text-[#6b6b9a] mt-0.5">{alert.description}</p>
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
              ))}
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
