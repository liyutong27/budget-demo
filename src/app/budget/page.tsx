"use client";

import { useMemo, useState } from "react";
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
import { LayoutGrid, List, Pencil, Eye, CheckCircle2, X } from "lucide-react";
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
  const [drillDept, setDrillDept] = useState<string | null>(null);

  const bva = useMemo(
    () => calculateBudgetVsActual(budgets, actuals, selectedMonth),
    [budgets, selectedMonth]
  );

  const activeBva = bva.filter((r) => r.allocated > 0 || r.actual > 0);

  // Drill-down transactions for selected department
  const drillTransactions = useMemo(() => {
    if (!drillDept) return [];
    return getTransactionsForDepartmentMonth(allTransactions, drillDept, selectedMonth)
      .sort((a, b) => b.amount - a.amount);
  }, [drillDept, selectedMonth]);

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

  // Quick resolve: mark flagged transaction as approved
  function resolveTransaction(txnId: string) {
    // In a real app this would call an API; here we just demonstrate the UI pattern
    const idx = allTransactions.findIndex((t) => t.id === txnId);
    if (idx !== -1) {
      allTransactions[idx] = { ...allTransactions[idx], flagged: false, status: "approved" };
    }
    setDrillDept(drillDept); // force re-render
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Budget - {editingDept ? DEPARTMENT_MAP[editingDept]?.name : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingDept && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => formatUSDT(Number(v))} />
                  <Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-1">
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
                    <span className="text-sm">{MONTH_LABELS[m]}</span>
                    <Input
                      type="number"
                      value={editValues[m] ?? 0}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [m]: parseFloat(e.target.value) || 0 }))
                      }
                      className="h-8 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">{formatUSDT(actual)}</span>
                    <span className={`text-sm ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatUSDT(variance)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingDept(null)}>Cancel</Button>
              <Button onClick={saveBudget}>Save Budget</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Drill-Down Dialog */}
      <Dialog open={!!drillDept} onOpenChange={(open) => !open && setDrillDept(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {drillDept ? DEPARTMENT_MAP[drillDept]?.name : ""} - {MONTH_LABELS[selectedMonth]} Transactions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {drillTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No transactions found for this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Applicant</th>
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                    <th className="text-center py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drillTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2">{txn.applicant}</td>
                      <td className="py-2 text-muted-foreground">{txn.category}</td>
                      <td className="py-2 max-w-[200px] truncate">{txn.description}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {txn.type === "human-capital" ? "HC" : "GE"}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-mono">{formatUSDT(txn.amount)}</td>
                      <td className="py-2 text-center">
                        {txn.flagged ? (
                          <div className="flex items-center gap-1 justify-center">
                            <Badge variant="destructive" className="text-[10px]">flagged</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1 text-green-600 hover:text-green-700"
                              onClick={() => resolveTransaction(txn.id)}
                              title="Quick resolve"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
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
            )}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              {drillTransactions.length} transactions | Total: {formatUSDT(drillTransactions.reduce((s, t) => s + t.amount, 0))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table View - Column order: Department | Allocated | Variance | Utilization | Actual | Status | Actions */}
      {viewMode === "table" && (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
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
                  return (
                    <tr key={row.departmentId} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                          <span className="font-medium">{row.departmentName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono">{formatUSDT(row.allocated)}</td>
                      <td className={`py-3 text-right font-mono ${row.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {row.variance >= 0 ? "+" : ""}{formatUSDT(row.variance)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(row.utilization, 100)}
                            className="h-2 w-24"
                          />
                          <span className="text-xs text-muted-foreground w-12">
                            {row.utilization.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono">
                        <button
                          className="hover:underline hover:text-blue-600 cursor-pointer"
                          onClick={() => setDrillDept(row.departmentId)}
                          title="Click to view transactions"
                        >
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
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setDrillDept(row.departmentId)} title="View transactions">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditor(row.departmentId)} title="Edit budget">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
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
            return (
              <Card key={row.departmentId} className="overflow-hidden">
                <div className="h-1" style={{ background: row.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{row.departmentName}</CardTitle>
                    <Badge
                      variant={status === "Over Budget" ? "destructive" : status === "At Risk" ? "secondary" : "outline"}
                      className="text-[10px]"
                    >
                      {status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Lead: {DEPARTMENT_MAP[row.departmentId]?.lead}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="relative w-20 h-20">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.9" fill="none"
                          stroke={row.utilization > 100 ? "#ef4444" : row.utilization > 90 ? "#f59e0b" : "#10b981"}
                          strokeWidth="3"
                          strokeDasharray={`${Math.min(row.utilization, 100)} ${100 - Math.min(row.utilization, 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold">{row.utilization.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-mono font-medium">{formatUSDT(row.allocated, true)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual</p>
                      <p className="font-mono font-medium cursor-pointer hover:text-blue-600" onClick={() => setDrillDept(row.departmentId)}>
                        {formatUSDT(row.actual, true)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setDrillDept(row.departmentId)}>
                      <Eye className="h-3 w-3 mr-1" /> Details
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEditor(row.departmentId)}>
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
