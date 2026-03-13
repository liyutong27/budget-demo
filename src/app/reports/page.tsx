"use client";

import React, { useState } from "react";
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
import { calculateBudgetVsActual, calculateKPISummary } from "@/lib/calculations";
import { buildSlackMessage } from "@/lib/slack";
import { MONTHS, MONTH_LABELS, DEPARTMENTS, CHART_COLORS } from "@/lib/constants";
import { Month, PLEntry } from "@/lib/types";
import plData from "@/data/pl-statement.json";
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Download, Send, TestTube2, ChevronDown, ChevronRight, FileText, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

const plEntries = plData as PLEntry[];

// Group P&L by category
const PL_CATEGORIES = ["Human Capital", "Marketing&Community", "Product", "Operations", "General Expense"];

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

function PLStatement() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(PL_CATEGORIES)
  );

  const displayMonths: Month[] = ["2025-12", "2026-01", "2026-02"];

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // Calculate category totals
  function getCategoryTotal(category: string, month: Month): number {
    if (category === "General Expense") {
      const entry = plEntries.find((e) => e.category === "General Expense");
      return entry?.monthly[month] ?? 0;
    }
    return plEntries
      .filter((e) => e.category === category && e.subCategory !== "Total")
      .reduce((sum, e) => sum + (e.monthly[month] ?? 0), 0);
  }

  function getGrandTotal(month: Month): number {
    return PL_CATEGORIES.reduce((sum, cat) => sum + getCategoryTotal(cat, month), 0);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Profit & Loss Statement (USDT)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 font-medium w-64">Category</th>
                {displayMonths.map((m) => (
                  <th key={m} className="text-right py-2 font-medium w-32">{MONTH_LABELS[m]}</th>
                ))}
                <th className="text-right py-2 font-medium w-32">YTD Total</th>
              </tr>
            </thead>
            <tbody>
              {PL_CATEGORIES.map((category) => {
                const isExpanded = expandedCategories.has(category);
                const subEntries = plEntries.filter(
                  (e) => e.category === category && e.subCategory !== "Total"
                );
                const ytdTotal = MONTHS.reduce((sum, m) => sum + getCategoryTotal(category, m), 0);

                return (
                  <React.Fragment key={category}>
                    {/* Category Header */}
                    <tr
                      className="border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleCategory(category)}
                    >
                      <td className="py-2 font-semibold">
                        <div className="flex items-center gap-1">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {category}
                        </div>
                      </td>
                      {displayMonths.map((m) => (
                        <td key={m} className="py-2 text-right font-mono font-semibold">
                          {formatUSDT(getCategoryTotal(category, m))}
                        </td>
                      ))}
                      <td className="py-2 text-right font-mono font-semibold">
                        {formatUSDT(ytdTotal)}
                      </td>
                    </tr>
                    {/* Sub-entries */}
                    {isExpanded &&
                      subEntries.map((entry) => {
                        const entryYtd = MONTHS.reduce(
                          (sum, m) => sum + (entry.monthly[m] ?? 0),
                          0
                        );
                        if (entryYtd === 0) return null;
                        return (
                          <tr key={entry.subCategory} className="border-b hover:bg-muted/30">
                            <td className="py-1.5 pl-8 text-muted-foreground">
                              {entry.subCategory}
                            </td>
                            {displayMonths.map((m) => (
                              <td key={m} className="py-1.5 text-right font-mono text-muted-foreground">
                                {entry.monthly[m] ? formatUSDT(entry.monthly[m]) : "-"}
                              </td>
                            ))}
                            <td className="py-1.5 text-right font-mono text-muted-foreground">
                              {formatUSDT(entryYtd)}
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
              {/* Grand Total */}
              <tr className="border-t-2 bg-slate-100 font-bold">
                <td className="py-2">TOTAL OPERATING EXPENSES</td>
                {displayMonths.map((m) => (
                  <td key={m} className="py-2 text-right font-mono">
                    {formatUSDT(getGrandTotal(m))}
                  </td>
                ))}
                <td className="py-2 text-right font-mono">
                  {formatUSDT(MONTHS.reduce((sum, m) => sum + getGrandTotal(m), 0))}
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
    month: MONTH_LABELS[m].slice(0, 3),
    budget: budgetsData.filter((b: any) => b.departmentId === selectedDept && b.month === m).reduce((s: number, b: any) => s + b.allocated, 0),
    actual: (actualsData as any[]).filter((a) => a.departmentId === selectedDept && a.month === m).reduce((s: number, a: any) => s + a.amount, 0),
  }));

  // Category breakdown
  const categories = Array.from(
    new Set((actualsData as any[]).filter((a) => a.departmentId === selectedDept).map((a) => a.category))
  );
  const categoryData = categories.map((cat) => ({
    category: cat,
    total: (actualsData as any[])
      .filter((a) => a.departmentId === selectedDept && a.category === cat)
      .reduce((s: number, a: any) => s + a.amount, 0),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">Lead: {dept.lead}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget vs Actuals</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => formatUSDT(Number(v))} />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill={CHART_COLORS.budget} radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.actual} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryData
                .sort((a, b) => b.total - a.total)
                .map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.category}</span>
                      <span className="font-mono">{formatUSDT(item.total)}</span>
                    </div>
                    <Progress
                      value={
                        (item.total / Math.max(...categoryData.map((c) => c.total))) * 100
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

function SlackIntegration() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channel, setChannel] = useState("#finance");
  const [reportType, setReportType] = useState("monthly_summary");
  const [sending, setSending] = useState(false);

  const month: Month = "2026-02";
  const kpi = calculateKPISummary(budgetsData as any[], actualsData as any[], transactionsData as any[], month, "2026-01");
  const bva = calculateBudgetVsActual(budgetsData as any[], actualsData as any[], month);
  const preview = buildSlackMessage(reportType, kpi, bva, MONTH_LABELS[month]);

  async function sendReport() {
    if (!webhookUrl) {
      toast.error("Please enter a Slack webhook URL");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, message: preview }),
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

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Config */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Slack Report Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Webhook URL</Label>
            <Input
              type="password"
              placeholder="https://hooks.slack.com/services/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Channel</Label>
            <Input value={channel} onChange={(e) => setChannel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly_summary">Monthly Summary</SelectItem>
                <SelectItem value="budget_alert">Budget Alert</SelectItem>
                <SelectItem value="pl_statement">P&L Statement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={testConnection} disabled={sending}>
              <TestTube2 className="h-3 w-3 mr-1" /> Test Connection
            </Button>
            <Button size="sm" onClick={sendReport} disabled={sending}>
              <Send className="h-3 w-3 mr-1" /> Send Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Message Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 text-white rounded-lg p-4 text-xs font-mono space-y-3 max-h-[400px] overflow-y-auto">
            {preview.blocks.map((block: any, i: number) => {
              if (block.type === "header") {
                return (
                  <div key={i} className="text-sm font-bold border-b border-slate-700 pb-2">
                    {block.text.text}
                  </div>
                );
              }
              if (block.type === "section" && block.fields) {
                return (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    {block.fields.map((f: any, j: number) => (
                      <div key={j} className="text-slate-300">
                        {f.text.replace(/\*/g, "")}
                      </div>
                    ))}
                  </div>
                );
              }
              if (block.type === "section" && block.text) {
                return (
                  <div key={i} className="whitespace-pre-wrap text-slate-300">
                    {block.text.text.replace(/\*/g, "")}
                  </div>
                );
              }
              if (block.type === "divider") {
                return <hr key={i} className="border-slate-700" />;
              }
              if (block.type === "context") {
                return (
                  <div key={i} className="text-[10px] text-slate-500">
                    {block.elements[0]?.text}
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
      budgetsData.forEach((b: any) => {
        csv += `${b.departmentId},${b.month},${b.allocated}\n`;
      });
    } else if (type === "transactions") {
      csv = "Date,Department,Category,Description,Amount,PaymentType,Status\n";
      transactionsData.forEach((t: any) => {
        csv += `${t.date},${t.departmentId},${t.category},"${t.description}",${t.amount},${t.paymentType},${t.status}\n`;
      });
    } else if (type === "pl") {
      csv = "Category,SubCategory," + MONTHS.map((m) => MONTH_LABELS[m]).join(",") + "\n";
      plEntries.forEach((e: any) => {
        csv += `${e.category},${e.subCategory},` + MONTHS.map((m) => e.monthly[m] ?? 0).join(",") + "\n";
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
        <Card key={item.type}>
          <CardContent className="py-6 text-center space-y-3">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCSV(item.type)}>
              <Download className="h-3 w-3 mr-1" /> Download CSV
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
