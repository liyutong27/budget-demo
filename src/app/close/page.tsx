"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { formatUSDT } from "@/lib/format";
import { MONTHS, MONTH_LABELS, DEPARTMENTS, DEPARTMENT_MAP } from "@/lib/constants";
import { Month, CloseMonth, Transaction } from "@/lib/types";
import closeData from "@/data/close-status.json";
import transactionsData from "@/data/transactions.json";
import {
  CheckCircle2, Circle, Loader2, Lock, User, Calendar,
} from "lucide-react";

type CloseCheckStatus = "not_started" | "in_progress" | "completed";

export default function ClosePage() {
  const [closeStatus, setCloseStatus] = useState<CloseMonth[]>(closeData as CloseMonth[]);
  const [selectedMonth, setSelectedMonth] = useState<Month>("feb-2026");

  const currentClose = closeStatus.find((c) => c.month === selectedMonth);
  const checks = currentClose?.checks ?? [];
  const completedCount = checks.filter((c) => c.status === "completed").length;
  const totalChecks = checks.length;
  const progressPct = totalChecks > 0 ? (completedCount / totalChecks) * 100 : 0;

  const allTxns = transactionsData as Transaction[];
  const monthTransactions = allTxns.filter((t) => t.month === selectedMonth);
  const pendingTxns = monthTransactions.filter((t) => t.flagged || t.status === "pending");

  function toggleCheck(checkId: number) {
    setCloseStatus((prev) =>
      prev.map((cm) => {
        if (cm.month !== selectedMonth) return cm;
        const newChecks = cm.checks.map((c) => {
          if (c.id !== checkId) return c;
          if (c.status === "completed") return c;
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
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value as Month)}
            className="appearance-none bg-[#0f0f22] border border-[#1e1e3a] text-[#e8e8ff] rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-[#9997FF] cursor-pointer"
          >
            {MONTHS.slice(-3).map((m) => {
              const status = getMonthStatus(m);
              const prefix = status === "closed" ? "\u2713 " : status === "in_progress" ? "\u25CB " : "  ";
              return (
                <option key={m} value={m}>
                  {prefix}{MONTH_LABELS[m]}
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            <svg className="h-4 w-4 text-[#6b6b9a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </PageHeader>

      {/* Progress Card */}
      <div className="bg-[#0f0f22] border border-[#1e1e3a] rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[#e8e8ff]">
            Close Progress - {MONTH_LABELS[selectedMonth]}
          </span>
          <span className="text-[11px] text-[#6b6b9a]">
            {completedCount} of {totalChecks} completed ({progressPct.toFixed(0)}%)
          </span>
        </div>
        <div className="w-full h-3 bg-[#1e1e3a] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#9997FF] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Checklist Items */}
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
                <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
              ) : isLocked ? (
                <Lock className="h-5 w-5 text-[#5a5a80]" />
              ) : (
                <Circle className="h-5 w-5 text-[#5a5a80]" />
              );

            const badgeClasses =
              check.status === "completed"
                ? "bg-green-500/12 text-green-400 border border-green-500/20"
                : check.status === "in_progress"
                ? "bg-yellow-500/12 text-yellow-400 border border-yellow-500/20"
                : "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF] border border-[#1e1e3a]";

            const borderLeftClass =
              check.status === "completed"
                ? "border-l-2 border-l-green-500/40"
                : check.status === "in_progress"
                ? "border-l-2 border-l-[#9997FF]/50"
                : "";

            return (
              <div
                key={check.id}
                className={`rounded-lg border border-[#1e1e3a] bg-[#0f0f22] p-4 transition-all hover:bg-[rgba(153,151,255,0.04)] ${borderLeftClass} ${
                  check.status === "completed" ? "opacity-70" : ""
                } ${isLocked ? "opacity-50" : ""}`}
              >
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
                      <h3 className={`text-sm font-semibold ${check.status === "completed" ? "line-through text-[#6b6b9a]" : "text-[#e8e8ff]"}`}>
                        Step {check.id}: {check.label}
                      </h3>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${badgeClasses}`}>
                        {check.status === "completed" ? "Done" : check.status === "in_progress" ? "In Progress" : "Pending"}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#6b6b9a] mt-1">{check.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-[#6b6b9a]">
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
              </div>
            );
          })}
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Pending Review Card */}
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22] p-5">
            <h3 className="text-sm font-semibold text-[#e8e8ff] mb-3">
              Pending Review ({pendingTxns.length})
            </h3>
            <div>
              {pendingTxns.length === 0 ? (
                <p className="text-xs text-[#6b6b9a]">No pending transactions</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {pendingTxns.map((txn) => (
                    <div
                      key={txn.id}
                      className="border border-[#1e1e3a] rounded-lg p-2 text-xs hover:bg-[rgba(153,151,255,0.06)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate max-w-[150px] text-[#e8e8ff]">{txn.description}</span>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${
                            txn.flagged
                              ? "bg-red-500/12 text-red-400 border border-red-500/20"
                              : "bg-[rgba(153,151,255,0.12)] text-[#ACAAFF] border border-[#1e1e3a]"
                          }`}
                        >
                          {txn.flagged ? "flagged" : txn.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[#6b6b9a]">
                        <span>{DEPARTMENT_MAP[txn.department]?.name ?? txn.department}</span>
                        <span className="font-mono text-right">{formatUSDT(txn.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Department Sign-off Card */}
          <div className="rounded-xl border border-[#1e1e3a] bg-[#0f0f22] p-5">
            <h3 className="text-sm font-semibold text-[#e8e8ff] mb-3">Department Sign-off</h3>
            <div className="space-y-2">
                {DEPARTMENTS.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {selectedMonth === "dec-2025" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-[#5a5a80]" />
                      )}
                      <span className="text-[#e8e8ff]">{dept.name}</span>
                    </div>
                    <span className="text-[#6b6b9a]">{dept.lead}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
