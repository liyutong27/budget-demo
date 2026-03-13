"use client";

import React, { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUSDT } from "@/lib/format";
import { calculateBudgetVsActual, calculateKPISummary, getActualTotal } from "@/lib/calculations";
import { buildSlackMessage } from "@/lib/slack";
import { MONTHS, MONTH_LABELS, DEPARTMENTS, CHART_COLORS } from "@/lib/constants";
import { Month, ActualsData, BudgetsData, Transaction } from "@/lib/types";
import plData from "@/data/pl-statement.json";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Download, Send, TestTube2, ChevronDown, ChevronRight, FileText, MessageSquare,
  AlertTriangle, AlertCircle, Flag,
} from "lucide-react";
import { toast } from "sonner";

const budgets = budgetsData as BudgetsData;
const actuals = actualsData as ActualsData;
const transactions = transactionsData as Transaction[];
const pl = plData as any;

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Financial reports, P&L, and Slack integration" />

      <Tabs defaultValue="pl" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pl">P&L Statement</TabsTrigger>
          <TabsTrigger value="department">Department Reports</TabsTrigger>
          <TabsTrigger value="slack">Slack Agent</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="pl">
          <PLStatement />
        </TabsContent>
        <TabsContent value="department">
          <DepartmentReports />
        </TabsContent>
        <TabsContent value="slack">
          <SlackIntegration />
        </TabsContent>
        <TabsContent value="export">
          <ExportSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// P&L categories map to the nested pl-statement.json structure
const PL_STRUCTURE = [
  {
    key: "humanCapital",
    label: "Human Capital",
    subcategories: [
      { key: "salary", label: "Salary" },
      { key: "headhunting", label: "Headhunting" },
      { key: "bonus", label: "Bonus" },
      { key: "signOnBonus", label: "Sign-on Bonus" },
      { key: "gasFees", label: "Gas Fees" },
      { key: "educationTraining", label: "Education & Training" },
      { key: "employeeBenefits", label: "Employee Benefits" },
      { key: "tokenOptionRepurchase", label: "Token Option Repurchase" },
    ],
  },
  {
    key: "generalExpense.marketingCommunity",
    label: "Marketing & Community",
    subcategories: [
      { key: "community", label: "Community" },
      { key: "event", label: "Event" },
      { key: "pr", label: "PR" },
      { key: "kol", label: "KOL" },
    ],
  },
  {
    key: "generalExpense.product",
    label: "Product",
    subcategories: [
      { key: "design", label: "Design" },
      { key: "dailyTechUsage", label: "Daily Tech Usage" },
    ],
  },
  {
    key: "generalExpense.operations",
    label: "Operations",
    subcategories: [
      { key: "legal", label: "Legal" },
      { key: "dailyOfficeUsage", label: "Daily Office Usage" },
      { key: "reimbursement", label: "Reimbursement" },
      { key: "travelBusiness", label: "Travel Business" },
      { key: "creditCardSubscription", label: "Credit Card Subscription" },
    ],
  },
];

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function PLStatement() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(PL_STRUCTURE.map((c) => c.key))
  );

  const displayMonths: Month[] = ["dec-2025", "jan-2026", "feb-2026"];

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function getCategoryTotal(catKey: string, month: Month): number {
    const data = getNestedValue(pl, catKey);
    return data?.total?.[month] ?? 0;
  }

  function getSubcategoryValue(catKey: string, subKey: string, month: Month): number {
    const data = getNestedValue(pl, catKey);
    return data?.[subKey]?.[month] ?? 0;
  }

  function getGrandTotal(month: Month): number {
    return (pl.totalExpenses?.[month] ?? 0);
  }

  function getYTD(getter: (m: Month) => number): number {
    return MONTHS.reduce((sum, m) => sum + getter(m), 0);
  }

  return (
    <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[#e8e8ff]">Profit & Loss Statement (USDT)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e3a] text-[10px] text-[#5a5a80] uppercase tracking-wider">
                <th className="text-left py-2 font-medium w-64">Category</th>
                {displayMonths.map((m) => (
                  <th key={m} className="text-right py-2 font-medium w-32">{MONTH_LABELS[m]}</th>
                ))}
                <th className="text-right py-2 font-medium w-32">YTD Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue */}
              <tr className="border-b border-[#1e1e3a] bg-[rgba(153,151,255,0.03)]">
                <td className="py-3 font-semibold text-[#e8e8ff]">Total Revenue</td>
                {displayMonths.map((m) => (
                  <td key={m} className="py-3 text-right font-mono font-semibold text-[#e8e8ff]">
                    {formatUSDT(pl.totalRevenue?.[m] ?? 0)}
                  </td>
                ))}
                <td className="py-3 text-right font-mono font-semibold text-[#e8e8ff]">
                  {formatUSDT(getYTD((m) => pl.totalRevenue?.[m] ?? 0))}
                </td>
              </tr>

              {PL_STRUCTURE.map((category) => {
                const isExpanded = expandedCategories.has(category.key);
                const ytdTotal = getYTD((m) => getCategoryTotal(category.key, m));

                return (
                  <React.Fragment key={category.key}>
                    <tr
                      className="border-b border-[#1e1e3a] bg-[rgba(153,151,255,0.03)] cursor-pointer hover:bg-[rgba(153,151,255,0.06)]"
                      onClick={() => toggleCategory(category.key)}
                    >
                      <td className="py-3 font-semibold text-[#e8e8ff]">
                        <div className="flex items-center gap-1">
                          {isExpanded ? <ChevronDown className="h-3 w-3 text-[#9997FF]" /> : <ChevronRight className="h-3 w-3 text-[#9997FF]" />}
                          {category.label}
                        </div>
                      </td>
                      {displayMonths.map((m) => (
                        <td key={m} className="py-3 text-right font-mono font-semibold text-[#e8e8ff]">
                          {formatUSDT(getCategoryTotal(category.key, m))}
                        </td>
                      ))}
                      <td className="py-3 text-right font-mono font-semibold text-[#e8e8ff]">
                        {formatUSDT(ytdTotal)}
                      </td>
                    </tr>
                    {isExpanded &&
                      category.subcategories.map((sub) => {
                        const subYtd = getYTD((m) => getSubcategoryValue(category.key, sub.key, m));
                        if (subYtd === 0) return null;
                        return (
                          <tr key={sub.key} className="border-b border-[#1e1e3a] hover:bg-[rgba(153,151,255,0.06)]">
                            <td className="py-1.5 pl-8 text-[#6b6b9a]">{sub.label}</td>
                            {displayMonths.map((m) => {
                              const val = getSubcategoryValue(category.key, sub.key, m);
                              return (
                                <td key={m} className="py-1.5 text-right font-mono text-[#6b6b9a]">
                                  {val > 0 ? formatUSDT(val) : "-"}
                                </td>
                              );
                            })}
                            <td className="py-1.5 text-right font-mono text-[#6b6b9a]">
                              {formatUSDT(subYtd)}
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}

              {/* Grand Total */}
              <tr className="border-t-2 border-[#1e1e3a] bg-[rgba(153,151,255,0.08)] font-bold">
                <td className="py-3 text-[#e8e8ff]">TOTAL OPERATING EXPENSES</td>
                {displayMonths.map((m) => (
                  <td key={m} className="py-3 text-right font-mono text-[#e8e8ff]">
                    {formatUSDT(getGrandTotal(m))}
                  </td>
                ))}
                <td className="py-3 text-right font-mono text-[#e8e8ff]">
                  {formatUSDT(getYTD((m) => getGrandTotal(m)))}
                </td>
              </tr>

              {/* Net */}
              <tr className="bg-[rgba(153,151,255,0.05)] font-bold">
                <td className="py-3 text-[#e8e8ff]">NET OPERATING INCOME</td>
                {displayMonths.map((m) => {
                  const net = pl.netOperatingIncome?.[m] ?? 0;
                  return (
                    <td key={m} className={`py-3 text-right font-mono ${net < 0 ? "text-red-400" : "text-green-400"}`}>
                      {formatUSDT(net)}
                    </td>
                  );
                })}
                <td className={`py-3 text-right font-mono ${getYTD((m) => pl.netOperatingIncome?.[m] ?? 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                  {formatUSDT(getYTD((m) => pl.netOperatingIncome?.[m] ?? 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DepartmentReports() {
  const [selectedDept, setSelectedDept] = useState<string>(DEPARTMENTS[0].id);
  const dept = DEPARTMENTS.find((d) => d.id === selectedDept)!;

  const chartData = MONTHS.map((m) => ({
    month: (MONTH_LABELS[m] ?? m).slice(0, 3),
    budget: budgets[selectedDept]?.[m]?.allocated ?? 0,
    actual: getActualTotal(actuals, selectedDept, m),
  }));

  // Category breakdown from transactions
  const deptTxns = transactions.filter((t) => t.department === selectedDept);
  const categoryMap = new Map<string, number>();
  deptTxns.forEach((t) => {
    categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + t.amount);
  });
  const categoryData = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger className="w-64 bg-[#0f0f22] border-[#1e1e3a] text-[#e8e8ff]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0f0f22] border-[#1e1e3a]">
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d.id} value={d.id} className="text-[#e8e8ff]">{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs border-[#1e1e3a] text-[#6b6b9a]">Lead: {dept.lead}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#e8e8ff]">Budget vs Actuals</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b6b9a" }} stroke="#1e1e3a" />
                <YAxis tick={{ fontSize: 11, fill: "#6b6b9a" }} stroke="#1e1e3a" tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(v) => formatUSDT(Number(v))}
                  contentStyle={{ backgroundColor: "#0f0f22", border: "1px solid #1e1e3a", color: "#e8e8ff" }}
                  labelStyle={{ color: "#6b6b9a" }}
                />
                <Legend wrapperStyle={{ color: "#6b6b9a" }} />
                <Bar dataKey="budget" name="Budget" fill={CHART_COLORS.budget} radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.actual} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#e8e8ff]">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] text-[#5a5a80] uppercase tracking-wider">
                <span>Category</span>
                <span>Amount</span>
              </div>
              {categoryData.slice(0, 8).map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#e8e8ff]">{item.category}</span>
                    <span className="font-mono text-[#6b6b9a]">{formatUSDT(item.total)}</span>
                  </div>
                  <Progress
                    value={
                      categoryData[0]?.total > 0
                        ? (item.total / categoryData[0].total) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DeptAlert {
  departmentName: string;
  departmentId: string;
  allocated: number;
  actual: number;
  utilization: number;
  status: "over" | "near" | "on-track";
}

interface AnomalyAlert {
  type: "high_value" | "flagged";
  description: string;
  amount: number;
  department: string;
  category: string;
}

function SlackIntegration() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channel, setChannel] = useState("#finance");
  const [reportType, setReportType] = useState("budget_alerts");
  const [sending, setSending] = useState(false);

  const month: Month = "feb-2026";
  const kpi = calculateKPISummary(budgets, actuals, transactions, month, "jan-2026");
  const bva = calculateBudgetVsActual(budgets, actuals, month);

  // Build department alerts
  const deptAlerts: DeptAlert[] = useMemo(() => {
    return bva
      .filter((d) => d.allocated > 0 || d.actual > 0)
      .map((d) => ({
        departmentName: d.departmentName,
        departmentId: d.departmentId,
        allocated: d.allocated,
        actual: d.actual,
        utilization: d.utilization,
        status: d.utilization > 100 ? "over" as const : d.utilization > 90 ? "near" as const : "on-track" as const,
      }))
      .sort((a, b) => b.utilization - a.utilization);
  }, [bva]);

  // Detect anomalous expenses
  const anomalies: AnomalyAlert[] = useMemo(() => {
    const monthTxns = transactions.filter((t) => t.month === month);
    const results: AnomalyAlert[] = [];
    const seen = new Set<string>();

    // High-value general expenses > $8000 (salaries excluded)
    monthTxns
      .filter((t) => t.amount > 8000 && t.type === "general-expense")
      .forEach((t) => {
        const id = `${t.date}-${t.description}-${t.amount}`;
        if (!seen.has(id)) {
          seen.add(id);
          results.push({
            type: "high_value",
            description: t.description,
            amount: t.amount,
            department: DEPARTMENTS.find((d) => d.id === t.department)?.name ?? t.department,
            category: t.category,
          });
        }
      });

    // Flagged transactions (any type)
    monthTxns
      .filter((t) => t.flagged)
      .forEach((t) => {
        const id = `${t.date}-${t.description}-${t.amount}`;
        if (!seen.has(id)) {
          seen.add(id);
          results.push({
            type: "flagged",
            description: t.description,
            amount: t.amount,
            department: DEPARTMENTS.find((d) => d.id === t.department)?.name ?? t.department,
            category: t.category,
          });
        } else {
          // Already added as high_value, mark as flagged too
          const existing = results.find(
            (r) => r.description === t.description && r.amount === t.amount
          );
          if (existing) existing.type = "flagged";
        }
      });

    return results.sort((a, b) => b.amount - a.amount);
  }, [month]);

  // Build preview blocks for the Slack-style message
  const previewBlocks = useMemo(() => {
    const blocks: { type: string; content: string; style?: string }[] = [];

    if (reportType === "budget_alerts") {
      blocks.push({ type: "header", content: `Budget Alerts - ${MONTH_LABELS[month]}` });
      blocks.push({ type: "divider", content: "" });

      deptAlerts.forEach((d) => {
        const compactActual = `$${Math.round(d.actual / 1000)}K`;
        const compactBudget = `$${Math.round(d.allocated / 1000)}K`;
        if (d.status === "over") {
          const overBy = `$${Math.round((d.actual - d.allocated) / 1000)}K`;
          blocks.push({
            type: "alert",
            content: `${d.departmentName} exceeded budget by ${overBy} (${d.utilization.toFixed(0)}% utilization)`,
            style: "critical",
          });
        } else if (d.status === "near") {
          blocks.push({
            type: "alert",
            content: `${d.departmentName} is at ${d.utilization.toFixed(0)}% budget utilization (${compactActual} / ${compactBudget})`,
            style: "warning",
          });
        } else {
          blocks.push({
            type: "alert",
            content: `${d.departmentName} on track at ${d.utilization.toFixed(0)}% (${compactActual} / ${compactBudget})`,
            style: "ok",
          });
        }
      });

      if (anomalies.length > 0) {
        blocks.push({ type: "divider", content: "" });
        blocks.push({ type: "subheader", content: "Anomalous Transactions" });
        anomalies.slice(0, 5).forEach((a) => {
          blocks.push({
            type: "flagged",
            content: `$${a.amount.toLocaleString()} ${a.category} - ${a.department}`,
            style: a.type === "flagged" ? "flagged" : "high_value",
          });
        });
      }
    } else if (reportType === "anomaly_report") {
      blocks.push({ type: "header", content: `Anomaly Report - ${MONTH_LABELS[month]}` });
      blocks.push({ type: "divider", content: "" });

      if (anomalies.length === 0) {
        blocks.push({ type: "text", content: "No anomalies detected this period." });
      } else {
        anomalies.forEach((a) => {
          blocks.push({
            type: "flagged",
            content: `$${a.amount.toLocaleString()} ${a.category} - ${a.department}`,
            style: a.type === "flagged" ? "flagged" : "high_value",
          });
          blocks.push({
            type: "text",
            content: a.description,
          });
        });
      }
    } else {
      // full_summary - use existing buildSlackMessage
      blocks.push({ type: "header", content: `Full Summary - ${MONTH_LABELS[month]}` });
      blocks.push({ type: "divider", content: "" });
      blocks.push({
        type: "text",
        content: `Total Budget: $${kpi.totalBudget.toLocaleString()} | Spend: $${kpi.totalSpend.toLocaleString()} | Utilization: ${kpi.utilization.toFixed(1)}% | Flagged: ${kpi.flaggedCount}`,
      });
      blocks.push({ type: "divider", content: "" });
      deptAlerts.forEach((d) => {
        const compactActual = `$${Math.round(d.actual / 1000)}K`;
        const compactBudget = `$${Math.round(d.allocated / 1000)}K`;
        blocks.push({
          type: "text",
          content: `${d.departmentName}: ${compactActual} / ${compactBudget} (${d.utilization.toFixed(0)}%)`,
        });
      });
    }

    blocks.push({ type: "divider", content: "" });
    blocks.push({ type: "context", content: `Generated by Budget Dashboard | ${new Date().toLocaleString()}` });

    return blocks;
  }, [reportType, deptAlerts, anomalies, kpi, month]);

  // Build Slack API-format message for sending
  function buildAlertSlackPayload() {
    if (reportType === "full_summary") {
      return buildSlackMessage(reportType, kpi, bva, MONTH_LABELS[month]);
    }

    const slackBlocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: reportType === "budget_alerts"
            ? `Budget Alerts - ${MONTH_LABELS[month]}`
            : `Anomaly Report - ${MONTH_LABELS[month]}`,
        },
      },
      { type: "divider" },
    ];

    if (reportType === "budget_alerts") {
      deptAlerts.forEach((d) => {
        const compactActual = `$${Math.round(d.actual / 1000)}K`;
        const compactBudget = `$${Math.round(d.allocated / 1000)}K`;
        let emoji = ":white_check_mark:";
        let text = "";
        if (d.status === "over") {
          const overBy = `$${Math.round((d.actual - d.allocated) / 1000)}K`;
          emoji = ":rotating_light:";
          text = `*${d.departmentName}* exceeded budget by ${overBy} (${d.utilization.toFixed(0)}% utilization)`;
        } else if (d.status === "near") {
          emoji = ":warning:";
          text = `*${d.departmentName}* is at ${d.utilization.toFixed(0)}% budget utilization (${compactActual} / ${compactBudget})`;
        } else {
          text = `*${d.departmentName}* on track at ${d.utilization.toFixed(0)}% (${compactActual} / ${compactBudget})`;
        }
        slackBlocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `${emoji} ${text}` },
        });
      });

      if (anomalies.length > 0) {
        slackBlocks.push({ type: "divider" });
        slackBlocks.push({
          type: "section",
          text: { type: "mrkdwn", text: "*Anomalous Transactions*" },
        });
        anomalies.slice(0, 5).forEach((a) => {
          const emoji = a.type === "flagged" ? ":red_circle:" : ":large_orange_circle:";
          slackBlocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *Flagged:* $${a.amount.toLocaleString()} ${a.category} - ${a.department}`,
            },
          });
        });
      }
    } else {
      // anomaly_report
      if (anomalies.length === 0) {
        slackBlocks.push({
          type: "section",
          text: { type: "mrkdwn", text: ":white_check_mark: No anomalies detected this period." },
        });
      } else {
        anomalies.forEach((a) => {
          const emoji = a.type === "flagged" ? ":red_circle:" : ":large_orange_circle:";
          slackBlocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *$${a.amount.toLocaleString()}* ${a.category} - ${a.department}\n${a.description}`,
            },
          });
        });
      }
    }

    slackBlocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Generated by Budget Dashboard | ${new Date().toLocaleString()}` },
      ],
    });

    return { blocks: slackBlocks };
  }

  async function sendReport() {
    if (!webhookUrl) {
      toast.error("Please enter a Slack webhook URL");
      return;
    }
    setSending(true);
    try {
      const payload = buildAlertSlackPayload();
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, message: payload }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Report sent to Slack!");
      } else {
        toast.error(data.error || "Failed to send");
      }
    } catch {
      toast.error("Failed to send report");
    }
    setSending(false);
  }

  async function testConnection() {
    if (!webhookUrl) {
      toast.error("Please enter a Slack webhook URL");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          message: {
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Test Connection" } },
              { type: "section", text: { type: "mrkdwn", text: "Budget Dashboard connected successfully!" } },
            ],
          },
        }),
      });
      const data = await res.json();
      if (data.ok) toast.success("Connection successful!");
      else toast.error(data.error || "Connection failed");
    } catch {
      toast.error("Connection failed");
    }
    setSending(false);
  }

  const overCount = deptAlerts.filter((d) => d.status === "over").length;
  const nearCount = deptAlerts.filter((d) => d.status === "near").length;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-4">
        {/* Config Card */}
        <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#e8e8ff] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#9997FF]" /> Slack Alert Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b9a]">Webhook URL</Label>
              <Input
                type="password"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="bg-[#0a0a1a] border-[#1e1e3a] text-[#e8e8ff] placeholder:text-[#3a3a5c]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b9a]">Channel</Label>
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="bg-[#0a0a1a] border-[#1e1e3a] text-[#e8e8ff]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b9a]">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="bg-[#0a0a1a] border-[#1e1e3a] text-[#e8e8ff]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f22] border-[#1e1e3a]">
                  <SelectItem value="budget_alerts" className="text-[#e8e8ff]">Budget Alerts</SelectItem>
                  <SelectItem value="anomaly_report" className="text-[#e8e8ff]">Anomaly Report</SelectItem>
                  <SelectItem value="full_summary" className="text-[#e8e8ff]">Full Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b6b9a]">Alert Thresholds</Label>
              <p className="text-[10px] text-[#6b6b9a]">
                Auto-alert when department utilization exceeds 90% (warning) or 100% (critical). General expenses &gt; $8,000 and flagged items are reported as anomalies. Salary payments are excluded.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={testConnection} disabled={sending} className="border-[#1e1e3a] text-[#e8e8ff] hover:bg-[rgba(153,151,255,0.06)]">
                <TestTube2 className="h-3 w-3 mr-1" /> Test Connection
              </Button>
              <Button size="sm" onClick={sendReport} disabled={sending} className="bg-[#9997FF] text-white hover:bg-[#8886ee]">
                <Send className="h-3 w-3 mr-1" /> Send Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Department Status Overview */}
        <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#e8e8ff] flex items-center gap-2">
              Department Status
              {overCount > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                  {overCount} over
                </Badge>
              )}
              {nearCount > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
                  {nearCount} near limit
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deptAlerts.map((d) => (
                <div
                  key={d.departmentId}
                  className="flex items-center justify-between py-1.5 px-2 rounded text-xs hover:bg-[rgba(153,151,255,0.06)]"
                >
                  <div className="flex items-center gap-2">
                    {d.status === "over" && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                    {d.status === "near" && <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />}
                    {d.status === "on-track" && <div className="h-3.5 w-3.5 rounded-full bg-green-500/60" />}
                    <span className="text-[#e8e8ff]">{d.departmentName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#6b6b9a]">
                      ${Math.round(d.actual / 1000)}K / ${Math.round(d.allocated / 1000)}K
                    </span>
                    <span className={`font-mono font-medium ${
                      d.status === "over" ? "text-red-400" : d.status === "near" ? "text-yellow-400" : "text-green-400"
                    }`}>
                      {d.utilization.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slack Preview */}
      <Card className="bg-[#0f0f22] border border-[#1e1e3a]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[#e8e8ff]">Message Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 text-white rounded-lg p-4 text-xs font-mono space-y-2.5 max-h-[500px] overflow-y-auto">
            {previewBlocks.map((block, i) => {
              if (block.type === "header") {
                return (
                  <div key={i} className="text-sm font-bold border-b border-slate-700 pb-2 text-white">
                    {block.content}
                  </div>
                );
              }
              if (block.type === "subheader") {
                return (
                  <div key={i} className="text-xs font-bold text-slate-300 pt-1">
                    {block.content}
                  </div>
                );
              }
              if (block.type === "divider") {
                return <hr key={i} className="border-slate-700" />;
              }
              if (block.type === "alert") {
                let icon = "";
                let textColor = "text-slate-300";
                if (block.style === "critical") {
                  icon = "\uD83D\uDEA8";
                  textColor = "text-red-400";
                } else if (block.style === "warning") {
                  icon = "\u26A0\uFE0F";
                  textColor = "text-yellow-300";
                } else {
                  icon = "\u2705";
                  textColor = "text-green-400";
                }
                return (
                  <div key={i} className={`${textColor} py-0.5`}>
                    {icon} {block.content}
                  </div>
                );
              }
              if (block.type === "flagged") {
                const icon = block.style === "flagged" ? "\uD83D\uDD34" : "\uD83D\uDFE0";
                return (
                  <div key={i} className="text-red-300 py-0.5">
                    {icon} Flagged: {block.content}
                  </div>
                );
              }
              if (block.type === "text") {
                return (
                  <div key={i} className="text-slate-300 whitespace-pre-wrap">
                    {block.content}
                  </div>
                );
              }
              if (block.type === "context") {
                return (
                  <div key={i} className="text-[10px] text-slate-500">
                    {block.content}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExportSection() {
  function exportCSV(type: string) {
    let csv = "";
    if (type === "budget") {
      csv = "Department,Month,Allocated\n";
      Object.entries(budgets).forEach(([dept, months]) => {
        Object.entries(months as Record<string, any>).forEach(([month, data]) => {
          csv += `${dept},${month},${(data as any).allocated}\n`;
        });
      });
    } else if (type === "transactions") {
      csv = "Date,Department,Category,Applicant,Description,Amount,PaymentType,Type,Status\n";
      transactions.forEach((t) => {
        csv += `${t.date},${t.department},${t.category},"${t.applicant}","${t.description}",${t.amount},${t.paymentType},${t.type},${t.status}\n`;
      });
    } else if (type === "pl") {
      csv = "Category,SubCategory," + MONTHS.map((m) => MONTH_LABELS[m]).join(",") + "\n";
      PL_STRUCTURE.forEach((cat) => {
        csv += `${cat.label},Total,` + MONTHS.map((m) => {
          const data = getNestedValue(pl, cat.key);
          return data?.total?.[m] ?? 0;
        }).join(",") + "\n";
        cat.subcategories.forEach((sub) => {
          csv += `${cat.label},${sub.label},` + MONTHS.map((m) => {
            const data = getNestedValue(pl, cat.key);
            return data?.[sub.key]?.[m] ?? 0;
          }).join(",") + "\n";
        });
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${type} report downloaded`);
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { type: "budget", title: "Budget Summary", desc: "Department budgets and allocations" },
        { type: "transactions", title: "Transaction Detail", desc: "All transactions with full details" },
        { type: "pl", title: "P&L Statement", desc: "Monthly profit & loss breakdown" },
      ].map((item) => (
        <Card key={item.type} className="bg-[#0f0f22] border border-[#1e1e3a]">
          <CardContent className="py-6 text-center space-y-3">
            <FileText className="h-8 w-8 mx-auto text-[#6b6b9a]" />
            <div>
              <h3 className="text-sm font-medium text-[#e8e8ff]">{item.title}</h3>
              <p className="text-xs text-[#6b6b9a]">{item.desc}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCSV(item.type)} className="border-[#1e1e3a] text-[#e8e8ff] hover:bg-[rgba(153,151,255,0.06)]">
              <Download className="h-3 w-3 mr-1" /> Download CSV
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
