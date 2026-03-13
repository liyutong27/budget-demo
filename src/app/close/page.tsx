"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUSDT, formatDate } from "@/lib/format";
import { MONTH_LABELS, DEPARTMENT_MAP } from "@/lib/constants";
import { Month, CloseMonth, CloseCheckStatus } from "@/lib/types";
import closeData from "@/data/close-status.json";
import transactionsData from "@/data/transactions.json";
import {
  CheckCircle2, Circle, Loader2, Lock, User, Calendar,
} from "lucide-react";

export default function ClosePage() {
  const [closeStatus, setCloseStatus] = useState<CloseMonth[]>(closeData as CloseMonth[]);
  const [selectedMonth, setSelectedMonth] = useState<Month>("2026-02");

  const currentClose = closeStatus.find((c) => c.month === selectedMonth);
  const checks = currentClose?.checks ?? [];
  const completedCount = checks.filter((c) => c.status === "completed").length;
  const totalChecks = checks.length;
  const progressPct = totalChecks > 0 ? (completedCount / totalChecks) * 100 : 0;

  const monthTransactions = transactionsData.filter((t) => t.date.startsWith(selectedMonth));
  const pendingTxns = monthTransactions.filter((t) => t.status === "pending" || t.status === "flagged");

  function toggleCheck(checkId: number) {
    setCloseStatus((prev) =>
      prev.map((cm) => {
        if (cm.month !== selectedMonth) return cm;
        const newChecks = cm.checks.map((c) => {
          if (c.id !== checkId) return c;
          if (c.status === "completed") return c; // Don't un-complete
          const newStatus: CloseCheckStatus =
            c.status === "not_started" ? "in_progress" : "completed";
          return {
            ...c,
            status: newStatus,
            ...(newStatus === "completed" ? { completedAt: new Date().toISOString().split("T")[0] } : {}),
          };
        });
        return { ...cm, checks: newChecks };
      })
    );
  }

  function getMonthStatus(month: Month): "closed" | "in_progress" | "not_started" {
    const cm = closeStatus.find((c) => c.month === month);
    if (!cm) return "not_started";
    if (cm.checks.every((c) => c.status === "completed")) return "closed";
    if (cm.checks.some((c) => c.status !== "not_started")) return "in_progress";
    return "not_started";
  }

  return (
    <div>
      <PageHeader title="Month-End Close" description="Close checklist and transaction review">
        <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v as Month)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["2025-12", "2026-01", "2026-02"] as Month[]).map((m) => {
              const status = getMonthStatus(m);
              return (
                <SelectItem key={m} value={m}>
                  <div className="flex items-center gap-2">
                    {status === "closed" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    {status === "in_progress" && <Loader2 className="h-3 w-3 text-amber-500" />}
                    {status === "not_started" && <Circle className="h-3 w-3 text-slate-300" />}
                    {MONTH_LABELS[m]}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Progress Bar */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Close Progress - {MONTH_LABELS[selectedMonth]}
            </span>
            <span className="text-sm text-muted-foreground">
              {completedCount} of {totalChecks} completed ({progressPct.toFixed(0)}%)
            </span>
          </div>
          <Progress value={progressPct} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        {/* Checklist */}
        <div className="col-span-2 space-y-3">
          {checks.map((check, index) => {
            const isLocked =
              index > 0 &&
              checks[index - 1].status !== "completed" &&
              check.status === "not_started";
            const statusIcon =
              check.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : check.status === "in_progress" ? (
                <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
              ) : isLocked ? (
                <Lock className="h-5 w-5 text-slate-300" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300" />
              );

            return (
              <Card
                key={check.id}
                className={`transition-all ${
                  check.status === "completed" ? "opacity-70" : ""
                } ${isLocked ? "opacity-50" : ""}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => !isLocked && toggleCheck(check.id)}
                      disabled={isLocked || check.status === "completed"}
                      className="mt-0.5 shrink-0"
                    >
                      {statusIcon}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-medium ${check.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          Step {check.id}: {check.label}
                        </h3>
                        <Badge
                          variant={
                            check.status === "completed"
                              ? "secondary"
                              : check.status === "in_progress"
                              ? "default"
                              : "outline"
                          }
                          className="text-[10px]"
                        >
                          {check.status === "completed" ? "Done" : check.status === "in_progress" ? "In Progress" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{check.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                        {check.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {check.assignee}
                          </span>
                        )}
                        {check.completedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {check.completedAt}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Pending Transactions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Review ({pendingTxns.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingTxns.length === 0 ? (
                <p className="text-xs text-muted-foreground">No pending transactions</p>
              ) : (
                <div className="space-y-3">
                  {pendingTxns.map((txn) => (
                    <div key={txn.id} className="border rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{txn.description}</span>
                        <Badge
                          variant={txn.status === "flagged" ? "destructive" : "outline"}
                          className="text-[10px]"
                        >
                          {txn.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-muted-foreground">
                        <span>{DEPARTMENT_MAP[txn.departmentId as keyof typeof DEPARTMENT_MAP]?.name}</span>
                        <span className="font-mono">{formatUSDT(txn.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Department Sign-off</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { dept: "Tech", lead: "Kevin Li", signed: selectedMonth === "2025-12" },
                  { dept: "Community", lead: "Sarah Kim", signed: selectedMonth === "2025-12" },
                  { dept: "Internal Ops", lead: "Jenny Zhang", signed: selectedMonth === "2025-12" },
                  { dept: "GTM", lead: "David Wang", signed: selectedMonth === "2025-12" },
                  { dept: "Credit Card", lead: "Mike Liu", signed: selectedMonth === "2025-12" || selectedMonth === "2026-01" },
                  { dept: "Product", lead: "Tom Wu", signed: selectedMonth === "2025-12" },
                  { dept: "Design", lead: "Lisa Park", signed: selectedMonth === "2025-12" },
                  { dept: "AWS & Infra", lead: "Alex Chen", signed: selectedMonth === "2025-12" },
                ].map((item) => (
                  <div key={item.dept} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {item.signed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>{item.dept}</span>
                    </div>
                    <span className="text-muted-foreground">{item.lead}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
