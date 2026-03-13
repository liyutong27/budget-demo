"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUSDT, formatPercent, formatMonth, formatDate } from "@/lib/format";
import { calculateKPISummary, calculateBudgetVsActual, getMonthlyTotals, getDepartmentTotals, generateAlerts } from "@/lib/calculations";
import { MONTHS, MONTH_LABELS, DEPARTMENT_MAP, CHART_COLORS } from "@/lib/constants";
import { Month } from "@/lib/types";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import {
  DollarSign, TrendingUp, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const budgets = budgetsData as any[];
const actuals = actualsData as any[];
const transactions = transactionsData as any[];

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<Month>("2026-02");
  const previousMonth = MONTHS[MONTHS.indexOf(selectedMonth) - 1] as Month | undefined;

  const kpi = useMemo(
    () => calculateKPISummary(budgets, actuals, transactions, selectedMonth, previousMonth),
    [selectedMonth, previousMonth]
  );
  const bva = useMemo(
    () => calculateBudgetVsActual(budgets, actuals, selectedMonth).filter((r) => r.allocated > 0 || r.actual > 0),
    [selectedMonth]
  );
  const monthlyTotals = useMemo(
    () => getMonthlyTotals(budgets, actuals, MONTHS),
    []
  );
  const deptTotals = useMemo(
    () => getDepartmentTotals(actuals, selectedMonth),
    [selectedMonth]
  );
  const alerts = useMemo(
    () => generateAlerts(budgets, actuals, transactions, selectedMonth),
    [selectedMonth]
  );

  const recentTxns = transactions.slice(0, 8);

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time budget overview">
        <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v as Month)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={m}>{MONTH_LABELS[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Budget"
          value={formatUSDT(kpi.totalBudget, true)}
          icon={<DollarSign className="h-4 w-4" />}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <KPICard
          title="Total Spend"
          value={formatUSDT(kpi.totalSpend, true)}
          subtitle={`${formatPercent(kpi.monthOverMonthChange)} MoM`}
          subtitleTrend={kpi.monthOverMonthChange}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-[#26a17b]"
          bgColor="bg-emerald-50"
        />
        <KPICard
          title="Utilization"
          value={formatPercent(kpi.utilization, false)}
          icon={<Clock className="h-4 w-4" />}
          color={kpi.utilization > 100 ? "text-red-600" : "text-amber-600"}
          bgColor={kpi.utilization > 100 ? "bg-red-50" : "bg-amber-50"}
        />
        <KPICard
          title="Flagged Txns"
          value={String(kpi.flaggedCount)}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={kpi.flaggedCount > 0 ? "text-red-600" : "text-green-600"}
          bgColor={kpi.flaggedCount > 0 ? "bg-red-50" : "bg-green-50"}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Budget vs Actuals */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget vs Actuals</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bva} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="departmentName" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => formatUSDT(Number(v))} />
                <Legend />
                <Bar dataKey="allocated" name="Budget" fill={CHART_COLORS.budget} radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.actual} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Breakdown Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Spend by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={deptTotals}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {deptTotals.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatUSDT(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">
              {deptTotals.map((d) => (
                <div key={d.name} className="flex items-center gap-1 text-[10px]">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Monthly Trend */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyTotals} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => MONTH_LABELS[v as Month]?.slice(0, 3) || String(v)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => formatUSDT(Number(v))} labelFormatter={(l) => MONTH_LABELS[l as Month] || l} />
                <Legend />
                <Area type="monotone" dataKey="budget" name="Budget" stroke={CHART_COLORS.budget} fill={CHART_COLORS.budget} fillOpacity={0.1} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="actual" name="Actual" stroke={CHART_COLORS.actual} fill={CHART_COLORS.actual} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alerts ({alerts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[240px] overflow-y-auto">
              {alerts.length === 0 && <p className="text-sm text-muted-foreground">No alerts</p>}
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant={alert.severity === "high" ? "destructive" : alert.severity === "medium" ? "secondary" : "outline"}
                    className="mt-0.5 shrink-0 text-[10px]"
                  >
                    {alert.type === "over_budget" ? "Budget" : alert.type === "flagged_transaction" ? "Flag" : "Pending"}
                  </Badge>
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-muted-foreground">{alert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Department</th>
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((txn) => (
                  <tr key={txn.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 text-muted-foreground">{formatDate(txn.date)}</td>
                    <td className="py-2">{DEPARTMENT_MAP[txn.departmentId as keyof typeof DEPARTMENT_MAP]?.name ?? txn.departmentId}</td>
                    <td className="py-2">{txn.description}</td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {txn.paymentType === "crypto_wallet" ? "Crypto" : txn.paymentType === "credit_card" ? "Card" : txn.paymentType === "bank_transfer" ? "Bank" : "Reimb"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right font-mono">{formatUSDT(txn.amount)}</td>
                    <td className="py-2">
                      <Badge
                        variant={txn.status === "approved" ? "secondary" : txn.status === "flagged" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {txn.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  title, value, subtitle, subtitleTrend, icon, color, bgColor,
}: {
  title: string; value: string; subtitle?: string; subtitleTrend?: number;
  icon: React.ReactNode; color: string; bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <div className={`${bgColor} ${color} p-1.5 rounded-lg`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {subtitleTrend !== undefined && (
              subtitleTrend >= 0
                ? <ArrowUpRight className="h-3 w-3 text-red-500" />
                : <ArrowDownRight className="h-3 w-3 text-green-500" />
            )}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
