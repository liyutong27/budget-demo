"use client";

import { Fragment, Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatUSDT, formatPercent } from "@/lib/format";
import {
  calculateGEBudgetRows,
  aggregateActuals,
  aggregateBudgets,
  getMonthsForPeriod,
  getPreviousPeriod,
  getTransactionsForDepartmentMonths,
  getActualTotal,
  detectFlaggedTransactions,
} from "@/lib/calculations";
import type { FlaggedItem } from "@/lib/calculations";
import { MONTHS, MONTH_LABELS, DEPARTMENTS, DEPARTMENT_MAP, QUARTER_LIST, QUARTER_LABELS } from "@/lib/constants";
import { Month, ActualsData, BudgetsData, Transaction, TimePeriodMode, Quarter, GEBudgetRow } from "@/lib/types";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
import { Pencil, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const actuals = actualsData as ActualsData;
const allTransactions = transactionsData as Transaction[];

export default function BudgetPageWrapper() {
  return (
    <Suspense>
      <BudgetPage />
    </Suspense>
  );
}

function BudgetPage() {
  const searchParams = useSearchParams();
  const [periodMode, setPeriodMode] = useState<TimePeriodMode>("month");
  const [periodValue, setPeriodValue] = useState<string>(MONTHS[MONTHS.length - 1]);
  const [activeTab, setActiveTab] = useState<"ge" | "hc">("ge");
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const [highlightTxn, setHighlightTxn] = useState<string | null>(null);

  // Read URL params on mount for drill-down from dashboard
  useEffect(() => {
    const tab = searchParams.get("tab");
    const dept = searchParams.get("dept");
    const highlight = searchParams.get("highlight");
    if (tab === "hc") setActiveTab("hc");
    if (dept) setExpandedDept(dept);
    if (highlight) {
      setHighlightTxn(highlight);
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => setHighlightTxn(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [budgets, setBudgets] = useState<BudgetsData>(budgetsData as BudgetsData);
  const [resolvedTxns, setResolvedTxns] = useState<Set<string>>(new Set());

  const months = useMemo(() => getMonthsForPeriod(periodMode, periodValue), [periodMode, periodValue]);
  const geRows = useMemo(() => calculateGEBudgetRows(budgets, actuals, months), [budgets, actuals, months]);

  // Period label for header
  const periodLabel = periodMode === "month"
    ? MONTH_LABELS[periodValue as Month] ?? periodValue
    : QUARTER_LABELS[periodValue as Quarter] ?? periodValue;

  // ─── GE Summary KPIs ────────────────────────────────────────
  const geSummary = useMemo(() => {
    const totalBudget = geRows.reduce((s, r) => s + r.geBudget, 0);
    const totalActual = geRows.reduce((s, r) => s + r.geActual, 0);
    const utilization = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
    return { totalBudget, totalActual, utilization };
  }, [geRows]);

  // ─── HC Summary KPIs ────────────────────────────────────────
  const hcSummary = useMemo(() => {
    let totalHCBudget = 0;
    let totalHCActual = 0;
    DEPARTMENTS.forEach((dept) => {
      const bud = aggregateBudgets(budgets, dept.id, months);
      const act = aggregateActuals(actuals, dept.id, months);
      totalHCBudget += bud.hc;
      totalHCActual += act.humanCapital;
    });

    // Previous period for comparison
    const prev = getPreviousPeriod(periodMode, periodValue);
    let prevHCActual = 0;
    if (prev) {
      const prevMonths = getMonthsForPeriod(prev.mode, prev.value);
      DEPARTMENTS.forEach((dept) => {
        const act = aggregateActuals(actuals, dept.id, prevMonths);
        prevHCActual += act.humanCapital;
      });
    }
    const periodChange = prevHCActual > 0 ? ((totalHCActual - prevHCActual) / prevHCActual) * 100 : 0;
    const avgPerDept = DEPARTMENTS.length > 0 ? totalHCActual / DEPARTMENTS.length : 0;

    return { totalHCBudget, totalHCActual, periodChange, avgPerDept, hasPrevious: !!prev };
  }, [budgets, months, periodMode, periodValue]);

  // ─── Smart flagged detection (same rules as dashboard) ───
  const smartFlagMap = useMemo(() => {
    const items = detectFlaggedTransactions(allTransactions, actuals, months);
    const map = new Map<string, FlaggedItem>();
    items.forEach((f) => map.set(f.transaction.id, f));
    return map;
  }, [months]);

  // ─── Expanded GE transactions (only general-expense type) ───
  const expandedTransactions = useMemo(() => {
    if (!expandedDept) return [];
    return getTransactionsForDepartmentMonths(allTransactions, expandedDept, months)
      .filter((t) => t.type === "general-expense")
      .map((t) => {
        if (resolvedTxns.has(t.id)) return { ...t, flagged: false, status: "approved" as const };
        // Mark as flagged if smart detection caught it
        if (smartFlagMap.has(t.id)) return { ...t, flagged: true };
        return t;
      })
      .sort((a, b) => b.amount - a.amount);
  }, [expandedDept, months, resolvedTxns, smartFlagMap]);

  // ─── Budget Editor ──────────────────────────────────────────
  function openEditor(deptId: string) {
    const values: Record<string, number> = {};
    MONTHS.forEach((m) => {
      values[m] = budgets[deptId]?.[m]?.generalExpense ?? 0;
    });
    setEditValues(values);
    setEditingDept(deptId);
  }

  function saveBudget() {
    if (!editingDept) return;
    const newBudgets = Object.fromEntries(
      Object.entries(budgets).map(([deptId, months]) => [
        deptId,
        Object.fromEntries(
          Object.entries(months).map(([m, data]) => [m, { ...data }])
        ),
      ])
    );
    if (!newBudgets[editingDept]) newBudgets[editingDept] = {};
    MONTHS.forEach((m) => {
      const geVal = editValues[m] ?? 0;
      const existing = newBudgets[editingDept][m];
      const hcVal = existing?.humanCapital ?? 0;
      newBudgets[editingDept][m] = {
        allocated: geVal + hcVal,
        humanCapital: hcVal,
        generalExpense: geVal,
      };
    });
    setBudgets(newBudgets);
    setEditingDept(null);
  }

  function resolveTransaction(txnId: string) {
    setResolvedTxns((prev) => { const next = new Set(prev); next.add(txnId); return next; });
  }

  function toggleExpand(deptId: string) {
    setExpandedDept((prev) => (prev === deptId ? null : deptId));
  }

  // Chart data for editor (GE only)
  const chartData = editingDept
    ? MONTHS.map((m) => {
        const geActual = actuals[editingDept]?.[m]?.generalExpense ?? 0;
        return {
          month: (MONTH_LABELS[m] ?? m).slice(0, 3),
          budget: editValues[m] ?? 0,
          actual: geActual,
        };
      })
    : [];

  // ─── HC rows per department ─────────────────────────────────
  const hcRows = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const bud = aggregateBudgets(budgets, dept.id, months);
      const act = aggregateActuals(actuals, dept.id, months);
      const variance = bud.hc - act.humanCapital;
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        color: dept.color,
        lead: dept.lead,
        hcBudget: bud.hc,
        hcActual: act.humanCapital,
        variance,
      };
    }).filter((r) => r.hcBudget > 0 || r.hcActual > 0);
  }, [budgets, months]);

  return (
    <div>
      <PageHeader title="Budgets" description={`Budget management - ${periodLabel}`}>
        <div className="flex items-center gap-3">
          {/* Tab Buttons */}
          <div className="flex items-center rounded-lg border border-[#1e1e3a] overflow-hidden">
            <button
              onClick={() => { setActiveTab("ge"); setExpandedDept(null); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "ge"
                  ? "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF]"
                  : "text-[#6b6b9a] hover:text-[#e8e8ff]"
              }`}
            >
              General Expense
            </button>
            <button
              onClick={() => { setActiveTab("hc"); setExpandedDept(null); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "hc"
                  ? "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF]"
                  : "text-[#6b6b9a] hover:text-[#e8e8ff]"
              }`}
            >
              Headcount
            </button>
          </div>

          {/* Period Mode Toggle */}
          <div className="flex items-center rounded-lg border border-[#1e1e3a] overflow-hidden">
            <button
              onClick={() => { setPeriodMode("month"); setPeriodValue(MONTHS[MONTHS.length - 1]); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                periodMode === "month"
                  ? "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF]"
                  : "text-[#6b6b9a] hover:text-[#e8e8ff]"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => { setPeriodMode("quarter"); setPeriodValue(QUARTER_LIST[QUARTER_LIST.length - 1]); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                periodMode === "quarter"
                  ? "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF]"
                  : "text-[#6b6b9a] hover:text-[#e8e8ff]"
              }`}
            >
              Quarter
            </button>
          </div>

          {/* Period Value Dropdown */}
          {periodMode === "month" ? (
            <Select value={periodValue} onValueChange={(v) => setPeriodValue(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>{MONTH_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={periodValue} onValueChange={(v) => setPeriodValue(v)}>
              <SelectTrigger className="w-36">
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
      </PageHeader>

      {/* ═══════════════════ GE TAB ═══════════════════ */}
      {activeTab === "ge" && (
        <>
          {/* GE KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#0f0f22] border border-[#1e1e3a] rounded-xl">
              <CardContent className="pt-5 pb-4">
                <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-1">Total GE Budget</p>
                <p className="text-xl font-bold font-mono text-[#e8e8ff]">{formatUSDT(geSummary.totalBudget, true)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0f0f22] border border-[#1e1e3a] rounded-xl">
              <CardContent className="pt-5 pb-4">
                <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-1">Total GE Spend</p>
                <p className="text-xl font-bold font-mono text-[#e8e8ff]">{formatUSDT(geSummary.totalActual, true)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0f0f22] border border-[#1e1e3a] rounded-xl">
              <CardContent className="pt-5 pb-4">
                <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-1">GE Utilization</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold font-mono text-[#e8e8ff]">{geSummary.utilization.toFixed(1)}%</p>
                  <Progress value={Math.min(geSummary.utilization, 100)} className="h-2 flex-1" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GE Main Table */}
          <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e3a] text-[10px] text-[#5a5a80] uppercase tracking-wider">
                    <th className="text-left py-2 font-medium">Department</th>
                    <th className="text-right py-2 font-medium">GE Budget</th>
                    <th className="text-right py-2 font-medium">GE Actual</th>
                    <th className="text-right py-2 font-medium">Variance</th>
                    <th className="text-left py-2 font-medium w-40">Utilization</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {geRows
                    .filter((r) => r.geBudget > 0 || r.geActual > 0)
                    .map((row) => {
                      const status =
                        row.geUtilization > 100 ? "Over Budget" : row.geUtilization > 90 ? "At Risk" : "On Track";
                      const isExpanded = expandedDept === row.departmentId;
                      const deptTransactions = isExpanded ? expandedTransactions : [];
                      return (
                        <Fragment key={row.departmentId}>
                          <tr
                            className="border-b border-[#1e1e3a] last:border-0 hover:bg-[rgba(153,151,255,0.06)] transition-colors cursor-pointer group"
                            onClick={() => toggleExpand(row.departmentId)}
                          >
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-[#ACAAFF]" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-[#6b6b9a] group-hover:text-[#ACAAFF] transition-colors" />
                                )}
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                                <div>
                                  <span className="font-medium text-[#e8e8ff]">{row.departmentName}</span>
                                  <p className="text-[10px] text-[#5a5a80] mt-0.5">{row.lead}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-right font-mono text-[#e8e8ff]">{formatUSDT(row.geBudget)}</td>
                            <td className="py-4 text-right font-mono text-[#e8e8ff]">{formatUSDT(row.geActual)}</td>
                            <td className={`py-4 text-right font-mono ${row.geVariance >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {row.geVariance >= 0 ? "+" : ""}{formatUSDT(row.geVariance)}
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={Math.min(row.geUtilization, 100)}
                                  className="h-2 w-24"
                                />
                                <span className="text-xs text-[#6b6b9a] w-12">
                                  {row.geUtilization.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-4">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  status === "Over Budget"
                                    ? "bg-[rgba(255,107,107,0.12)] text-[#ff6b6b] border-[rgba(255,107,107,0.2)]"
                                    : status === "At Risk"
                                    ? "bg-[rgba(255,184,108,0.12)] text-[#ffb86c] border-[rgba(255,184,108,0.2)]"
                                    : "bg-[rgba(80,250,123,0.12)] text-[#50fa7b] border-[rgba(80,250,123,0.2)]"
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); openEditor(row.departmentId); }}
                                title="Edit GE budget"
                                className="text-[#6b6b9a] hover:text-[#e8e8ff] hover:bg-[rgba(153,151,255,0.06)]"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                          {/* Inline expanded GE transactions */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-0">
                                <div className="bg-[#0a0a1a] border-y border-[#1e1e3a] border-l-2 border-l-[#9997FF] px-6 py-4">
                                  {deptTransactions.length === 0 ? (
                                    <p className="text-sm text-[#6b6b9a] py-2">No general expense transactions found for this period.</p>
                                  ) : (
                                    <>
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-[#1e1e3a] text-xs text-[#6b6b9a]">
                                            <th className="text-left py-2 font-medium">Applicant</th>
                                            <th className="text-left py-2 font-medium">Category</th>
                                            <th className="text-left py-2 font-medium">Description</th>
                                            <th className="text-right py-2 font-medium">Amount</th>
                                            <th className="text-center py-2 font-medium">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {deptTransactions.map((txn) => (
                                            <tr
                                              key={txn.id}
                                              id={`txn-${txn.id}`}
                                              ref={(el) => {
                                                if (el && highlightTxn === txn.id) {
                                                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                                                }
                                              }}
                                              className={`border-b border-[#1e1e3a] last:border-0 hover:bg-[rgba(153,151,255,0.06)] transition-colors ${
                                                highlightTxn === txn.id
                                                  ? "bg-[rgba(255,184,108,0.15)] border-[rgba(255,184,108,0.3)]"
                                                  : ""
                                              }`}
                                            >
                                              <td className="py-2 text-[#e8e8ff]">{txn.applicant}</td>
                                              <td className="py-2 text-[#6b6b9a]">{txn.category}</td>
                                              <td className="py-2 max-w-[200px] truncate text-[#e8e8ff]">{txn.description}</td>
                                              <td className="py-2 text-right font-mono text-[#e8e8ff]">{formatUSDT(txn.amount)}</td>
                                              <td className="py-2 text-center">
                                                {txn.flagged ? (
                                                  <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-2">
                                                      <Badge variant="destructive" className="text-[10px]">
                                                        {smartFlagMap.get(txn.id)?.severity ?? "flagged"}
                                                      </Badge>
                                                      <Button
                                                        size="sm"
                                                        className="h-6 px-2 text-xs bg-green-600 text-white hover:bg-green-700"
                                                        onClick={() => resolveTransaction(txn.id)}
                                                      >
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Resolve
                                                      </Button>
                                                    </div>
                                                    {smartFlagMap.get(txn.id) && (
                                                      <p className="text-[9px] text-[#ffb86c] max-w-[250px] text-center leading-tight">
                                                        {smartFlagMap.get(txn.id)!.reasons[0]}
                                                      </p>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <Badge variant="secondary" className="text-[10px]">{txn.status}</Badge>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <div className="text-xs text-[#6b6b9a] pt-3 mt-2 border-t border-[#1e1e3a]">
                                        {deptTransactions.length} transactions | Total: {formatUSDT(deptTransactions.reduce((s, t) => s + t.amount, 0))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
              <p className="text-[11px] text-[#5a5a80] mt-4 text-center">Click any department row to view general expense transactions</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════════════════ HC TAB ═══════════════════ */}
      {activeTab === "hc" && (
        <>
          {/* HC KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#0f0f22] border border-[#1e1e3a] rounded-xl">
              <CardContent className="pt-5 pb-4">
                <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-1">Total HC Cost</p>
                <p className="text-xl font-bold font-mono text-[#e8e8ff]">{formatUSDT(hcSummary.totalHCActual, true)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0f0f22] border border-[#1e1e3a] rounded-xl">
              <CardContent className="pt-5 pb-4">
                <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-1">vs Previous Period</p>
                {hcSummary.hasPrevious ? (
                  <p className={`text-xl font-bold font-mono ${hcSummary.periodChange >= 0 ? "text-red-400" : "text-green-400"}`}>
                    {formatPercent(hcSummary.periodChange)}
                  </p>
                ) : (
                  <p className="text-xl font-bold font-mono text-[#5a5a80]">--</p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-[#0f0f22] border border-[#1e1e3a] rounded-xl">
              <CardContent className="pt-5 pb-4">
                <p className="text-[10px] text-[#5a5a80] uppercase tracking-wider mb-1">Avg HC per Department</p>
                <p className="text-xl font-bold font-mono text-[#e8e8ff]">{formatUSDT(hcSummary.avgPerDept, true)}</p>
              </CardContent>
            </Card>
          </div>

          {/* HC Main Table (read-only) */}
          <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e3a] text-[10px] text-[#5a5a80] uppercase tracking-wider">
                    <th className="text-left py-2 font-medium">Department</th>
                    <th className="text-right py-2 font-medium">HC Budget</th>
                    <th className="text-right py-2 font-medium">HC Actual</th>
                    <th className="text-right py-2 font-medium">Variance</th>
                    <th className="text-left py-2 font-medium w-40">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {hcRows.map((row) => (
                    <tr
                      key={row.departmentId}
                      className="border-b border-[#1e1e3a] last:border-0"
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                          <div>
                            <span className="font-medium text-[#e8e8ff]">{row.departmentName}</span>
                            <p className="text-[10px] text-[#5a5a80] mt-0.5">{row.lead}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right font-mono text-[#e8e8ff]">{formatUSDT(row.hcBudget)}</td>
                      <td className="py-4 text-right font-mono text-[#e8e8ff]">{formatUSDT(row.hcActual)}</td>
                      <td className={`py-4 text-right font-mono ${row.variance >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {row.variance >= 0 ? "+" : ""}{formatUSDT(row.variance)}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(row.hcBudget > 0 ? (row.hcActual / row.hcBudget) * 100 : 0, 100)}
                            className="h-2 w-24"
                          />
                          <span className="text-xs text-[#6b6b9a] w-12">
                            {row.hcBudget > 0 ? ((row.hcActual / row.hcBudget) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-[#5a5a80] mt-4 text-center border-t border-[#1e1e3a] pt-3">
                Headcount costs are managed by Finance. Contact finance@donut.xyz for adjustments.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════════════════ GE Budget Editor Dialog ═══════════════════ */}
      <Dialog open={!!editingDept} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0f0f22] border-[#1e1e3a] text-[#e8e8ff]">
          <DialogHeader>
            <DialogTitle className="text-[#e8e8ff]">
              Edit GE Budget - {editingDept ? DEPARTMENT_MAP[editingDept]?.name : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingDept && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b6b9a" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b6b9a" }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(v) => formatUSDT(Number(v))}
                    contentStyle={{ backgroundColor: "#0f0f22", border: "1px solid #1e1e3a", color: "#e8e8ff" }}
                    labelStyle={{ color: "#6b6b9a" }}
                  />
                  <Bar dataKey="budget" name="GE Budget" fill="#9997FF" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="GE Actual" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-[#6b6b9a] px-1">
                <span>Month</span>
                <span>GE Budget (USDT)</span>
                <span>GE Actual</span>
                <span>Variance</span>
              </div>
              {MONTHS.map((m) => {
                const geActual = editingDept ? (actuals[editingDept]?.[m]?.generalExpense ?? 0) : 0;
                const alloc = editValues[m] ?? 0;
                const variance = alloc - geActual;
                return (
                  <div key={m} className="grid grid-cols-4 gap-2 items-center">
                    <span className="text-sm text-[#e8e8ff]">{MONTH_LABELS[m]}</span>
                    <Input
                      type="number"
                      value={editValues[m] ?? 0}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [m]: parseFloat(e.target.value) || 0 }))
                      }
                      className="h-8 text-sm bg-[#0a0a1a] border-[#1e1e3a] text-[#e8e8ff]"
                    />
                    <span className="text-sm text-[#6b6b9a]">{formatUSDT(geActual)}</span>
                    <span className={`text-sm ${variance >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatUSDT(variance)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingDept(null)} className="border-[#1e1e3a] text-[#e8e8ff] hover:bg-[rgba(153,151,255,0.06)]">Cancel</Button>
              <Button onClick={saveBudget} className="bg-[#9997FF] text-white hover:bg-[#ACAAFF]">Save Budget</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
