"use client";

import { Fragment, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatUSDT, formatPercent, formatDate } from "@/lib/format";
import { calculateBudgetVsActual, getActualTotal, getTransactionsForDepartmentMonth } from "@/lib/calculations";
import { MONTHS, MONTH_LABELS, DEPARTMENTS, DEPARTMENT_MAP } from "@/lib/constants";
import { Month, ActualsData, BudgetsData, Transaction } from "@/lib/types";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
import { LayoutGrid, List, Pencil, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const actuals = actualsData as ActualsData;
const allTransactions = transactionsData as Transaction[];

export default function BudgetPage() {
  const [selectedMonth, setSelectedMonth] = useState<Month>("feb-2026");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [budgets, setBudgets] = useState<BudgetsData>(budgetsData as BudgetsData);
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const bva = useMemo(
    () => calculateBudgetVsActual(budgets, actuals, selectedMonth),
    [budgets, selectedMonth]
  );

  const activeBva = bva.filter((r) => r.allocated > 0 || r.actual > 0);

  // Inline drill-down transactions for expanded department
  const expandedTransactions = useMemo(() => {
    if (!expandedDept) return [];
    return getTransactionsForDepartmentMonth(allTransactions, expandedDept, selectedMonth)
      .sort((a, b) => b.amount - a.amount);
  }, [expandedDept, selectedMonth]);

  function openEditor(deptId: string) {
    const values: Record<string, number> = {};
    MONTHS.forEach((m) => {
      values[m] = budgets[deptId]?.[m]?.allocated ?? 0;
    });
    setEditValues(values);
    setEditingDept(deptId);
  }

  function saveBudget() {
    if (!editingDept) return;
    const newBudgets = { ...budgets };
    if (!newBudgets[editingDept]) newBudgets[editingDept] = {};
    MONTHS.forEach((m) => {
      const val = editValues[m] ?? 0;
      newBudgets[editingDept][m] = {
        allocated: val,
        humanCapital: val * 0.7,
        generalExpense: val * 0.3,
      };
    });
    setBudgets(newBudgets);
    setEditingDept(null);
  }

  // Counter to force re-render when transactions are mutated
  const [, setRenderTick] = useState(0);

  // Quick resolve: mark flagged transaction as approved
  function resolveTransaction(txnId: string) {
    const idx = allTransactions.findIndex((t) => t.id === txnId);
    if (idx !== -1) {
      allTransactions[idx] = { ...allTransactions[idx], flagged: false, status: "approved" };
    }
    // Force re-render
    setRenderTick((t) => t + 1);
  }

  function toggleExpand(deptId: string) {
    setExpandedDept((prev) => (prev === deptId ? null : deptId));
  }

  const chartData = editingDept
    ? MONTHS.map((m) => ({
        month: (MONTH_LABELS[m] ?? m).slice(0, 3),
        budget: editValues[m] ?? 0,
        actual: getActualTotal(actuals, editingDept, m),
      }))
    : [];

  return (
    <div>
      <PageHeader title="Budgets" description={`Budget management - ${MONTH_LABELS[selectedMonth]}`}>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "cards" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
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
        </div>
      </PageHeader>

      {/* Budget Editor Dialog */}
      <Dialog open={!!editingDept} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0f0f22] border-[#1e1e3a] text-[#e8e8ff]">
          <DialogHeader>
            <DialogTitle className="text-[#e8e8ff]">
              Edit Budget - {editingDept ? DEPARTMENT_MAP[editingDept]?.name : ""}
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
                  <Bar dataKey="budget" name="Budget" fill="#9997FF" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-[#6b6b9a] px-1">
                <span>Month</span>
                <span>Allocated (USDT)</span>
                <span>Actual</span>
                <span>Variance</span>
              </div>
              {MONTHS.map((m) => {
                const actual = editingDept ? getActualTotal(actuals, editingDept, m) : 0;
                const alloc = editValues[m] ?? 0;
                const variance = alloc - actual;
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
                    <span className="text-sm text-[#6b6b9a]">{formatUSDT(actual)}</span>
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

      {/* Table View - Column order: Department | Allocated | Variance | Utilization | Actual | Status | Actions */}
      {viewMode === "table" && (
        <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e3a] text-xs text-[#6b6b9a]">
                  <th className="text-left py-2 font-medium">Department</th>
                  <th className="text-right py-2 font-medium">Allocated</th>
                  <th className="text-right py-2 font-medium">Variance</th>
                  <th className="text-left py-2 font-medium w-40">Utilization</th>
                  <th className="text-right py-2 font-medium">Actual</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeBva.map((row) => {
                  const status =
                    row.utilization > 100 ? "Over Budget" : row.utilization > 90 ? "At Risk" : "On Track";
                  const isExpanded = expandedDept === row.departmentId;
                  const deptTransactions = isExpanded ? expandedTransactions : [];
                  return (
                    <Fragment key={row.departmentId}>
                      <tr
                        className="border-b border-[#1e1e3a] last:border-0 hover:bg-[rgba(153,151,255,0.06)] transition-colors"
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                            <span className="font-medium text-[#e8e8ff]">{row.departmentName}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono text-[#e8e8ff]">{formatUSDT(row.allocated)}</td>
                        <td className={`py-3 text-right font-mono ${row.variance >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {row.variance >= 0 ? "+" : ""}{formatUSDT(row.variance)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(row.utilization, 100)}
                              className="h-2 w-24"
                            />
                            <span className="text-xs text-[#6b6b9a] w-12">
                              {row.utilization.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono">
                          <button
                            className="hover:underline cursor-pointer flex items-center gap-1 justify-end text-[#ACAAFF] hover:text-[#9997FF]"
                            onClick={() => toggleExpand(row.departmentId)}
                            title="Click to view transactions"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            {formatUSDT(row.actual)}
                          </button>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={status === "Over Budget" ? "destructive" : status === "At Risk" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditor(row.departmentId)} title="Edit budget" className="text-[#6b6b9a] hover:text-[#e8e8ff] hover:bg-[rgba(153,151,255,0.06)]">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                      {/* Inline expanded transactions */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <div className="bg-[#0a0a1a] border-y border-[#1e1e3a] px-6 py-4">
                              {deptTransactions.length === 0 ? (
                                <p className="text-sm text-[#6b6b9a] py-2">No transactions found for this period.</p>
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
                                        <tr key={txn.id} className="border-b border-[#1e1e3a] last:border-0 hover:bg-[rgba(153,151,255,0.06)]">
                                          <td className="py-2 text-[#e8e8ff]">{txn.applicant}</td>
                                          <td className="py-2 text-[#6b6b9a]">{txn.category}</td>
                                          <td className="py-2 max-w-[200px] truncate text-[#e8e8ff]">{txn.description}</td>
                                          <td className="py-2 text-right font-mono text-[#e8e8ff]">{formatUSDT(txn.amount)}</td>
                                          <td className="py-2 text-center">
                                            {txn.flagged ? (
                                              <div className="flex items-center gap-2 justify-center">
                                                <Badge variant="destructive" className="text-[10px]">flagged</Badge>
                                                <Button
                                                  size="sm"
                                                  className="h-6 px-2 text-xs bg-green-600 text-white hover:bg-green-700"
                                                  onClick={() => resolveTransaction(txn.id)}
                                                >
                                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                                  Resolve
                                                </Button>
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
          </CardContent>
        </Card>
      )}

      {/* Cards View */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {activeBva.map((row) => {
            const status =
              row.utilization > 100 ? "Over Budget" : row.utilization > 90 ? "At Risk" : "On Track";
            const isExpanded = expandedDept === row.departmentId;
            const deptTransactions = isExpanded
              ? getTransactionsForDepartmentMonth(allTransactions, row.departmentId, selectedMonth).sort((a, b) => b.amount - a.amount)
              : [];
            return (
              <Card key={row.departmentId} className="overflow-hidden bg-[#0f0f22] border border-[#1e1e3a]">
                <div className="h-1" style={{ background: row.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-[#e8e8ff]">{row.departmentName}</CardTitle>
                    <Badge
                      variant={status === "Over Budget" ? "destructive" : status === "At Risk" ? "secondary" : "outline"}
                      className="text-[10px]"
                    >
                      {status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-[#6b6b9a]">
                    Lead: {DEPARTMENT_MAP[row.departmentId]?.lead}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="relative w-20 h-20">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e1e3a" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9" fill="none"
                          stroke={row.utilization > 100 ? "#ef4444" : row.utilization > 90 ? "#f59e0b" : "#22c55e"}
                          strokeWidth="3"
                          strokeDasharray={`${Math.min(row.utilization, 100)} ${100 - Math.min(row.utilization, 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-[#e8e8ff]">{row.utilization.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[#6b6b9a]">Budget</p>
                      <p className="font-mono font-medium text-[#e8e8ff]">{formatUSDT(row.allocated, true)}</p>
                    </div>
                    <div>
                      <p className="text-[#6b6b9a]">Actual</p>
                      <p
                        className="font-mono font-medium cursor-pointer text-[#ACAAFF] hover:text-[#9997FF]"
                        onClick={() => toggleExpand(row.departmentId)}
                      >
                        {formatUSDT(row.actual, true)}
                      </p>
                    </div>
                  </div>

                  {/* Inline expanded transactions in card view */}
                  {isExpanded && (
                    <div className="bg-[#0a0a1a] border border-[#1e1e3a] rounded-md p-3 mt-2">
                      {deptTransactions.length === 0 ? (
                        <p className="text-xs text-[#6b6b9a]">No transactions found.</p>
                      ) : (
                        <>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {deptTransactions.map((txn) => (
                              <div key={txn.id} className="flex items-center justify-between text-xs border-b border-[#1e1e3a] pb-1 last:border-0">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[#e8e8ff] truncate">{txn.applicant}</p>
                                  <p className="text-[#6b6b9a] truncate text-[10px]">{txn.description}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <span className="font-mono text-[#e8e8ff]">{formatUSDT(txn.amount)}</span>
                                  {txn.flagged ? (
                                    <Button
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px] bg-green-600 text-white hover:bg-green-700"
                                      onClick={() => resolveTransaction(txn.id)}
                                    >
                                      Resolve
                                    </Button>
                                  ) : (
                                    <Badge variant="secondary" className="text-[8px]">{txn.status}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="text-[10px] text-[#6b6b9a] pt-2 mt-1 border-t border-[#1e1e3a]">
                            {deptTransactions.length} txns | {formatUSDT(deptTransactions.reduce((s, t) => s + t.amount, 0))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs border-[#1e1e3a] text-[#ACAAFF] hover:bg-[rgba(153,151,255,0.06)]"
                      onClick={() => toggleExpand(row.departmentId)}
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                      {isExpanded ? "Collapse" : "Details"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs border-[#1e1e3a] text-[#ACAAFF] hover:bg-[rgba(153,151,255,0.06)]"
                      onClick={() => openEditor(row.departmentId)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
