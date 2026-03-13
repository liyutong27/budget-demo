"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUSDT, formatPercent, formatMonth } from "@/lib/format";
import { calculateBudgetVsActual, getActualsByDepartmentMonth } from "@/lib/calculations";
import { MONTHS, MONTH_LABELS, DEPARTMENTS, DEPARTMENT_MAP } from "@/lib/constants";
import { Month, DepartmentId, BudgetAllocation } from "@/lib/types";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import { LayoutGrid, List, Plus, Pencil } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function BudgetPage() {
  const [selectedMonth, setSelectedMonth] = useState<Month>("2026-02");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [budgets, setBudgets] = useState<BudgetAllocation[]>(budgetsData as BudgetAllocation[]);
  const [editingDept, setEditingDept] = useState<DepartmentId | null>(null);
  const [editValues, setEditValues] = useState<Record<Month, number>>({} as Record<Month, number>);

  const bva = useMemo(
    () => calculateBudgetVsActual(budgets, actualsData as any[], selectedMonth),
    [budgets, selectedMonth]
  );

  const activeBva = bva.filter((r) => r.allocated > 0 || r.actual > 0);

  function openEditor(deptId: DepartmentId) {
    const values: Record<string, number> = {};
    MONTHS.forEach((m) => {
      const entry = budgets.find((b) => b.departmentId === deptId && b.month === m);
      values[m] = entry?.allocated ?? 0;
    });
    setEditValues(values as Record<Month, number>);
    setEditingDept(deptId);
  }

  function saveBudget() {
    if (!editingDept) return;
    const newBudgets = budgets.filter((b) => b.departmentId !== editingDept);
    MONTHS.forEach((m) => {
      const val = editValues[m] ?? 0;
      if (val > 0) {
        newBudgets.push({ departmentId: editingDept, month: m, allocated: val });
      }
    });
    setBudgets(newBudgets);
    setEditingDept(null);
  }

  // Chart data for selected department
  const chartData = editingDept
    ? MONTHS.map((m) => ({
        month: MONTH_LABELS[m].slice(0, 3),
        budget: editValues[m] ?? 0,
        actual: getActualsByDepartmentMonth(actualsData as any[], editingDept, m),
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
            {/* Mini Chart Preview */}
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

            {/* Monthly Allocation Grid */}
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Month</span>
                <span>Allocated (USDT)</span>
                <span>Actual</span>
                <span>Variance</span>
              </div>
              {MONTHS.map((m) => {
                const actual = editingDept
                  ? getActualsByDepartmentMonth(actualsData as any[], editingDept, m)
                  : 0;
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

      {/* Table View */}
      {viewMode === "table" && (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 font-medium">Department</th>
                  <th className="text-right py-2 font-medium">Allocated</th>
                  <th className="text-right py-2 font-medium">Actual</th>
                  <th className="text-right py-2 font-medium">Variance</th>
                  <th className="text-left py-2 font-medium w-40">Utilization</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bva.map((row) => {
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
                      <td className="py-3 text-right font-mono">{formatUSDT(row.actual)}</td>
                      <td className={`py-3 text-right font-mono ${row.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatUSDT(row.variance)}
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
                      <td className="py-3">
                        <Badge
                          variant={status === "Over Budget" ? "destructive" : status === "At Risk" ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditor(row.departmentId)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {bva.map((row) => {
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
                      <p className="font-mono font-medium">{formatUSDT(row.actual, true)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => openEditor(row.departmentId)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit Budget
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
