import { ActualsData, BudgetsData, BudgetVsActual, KPISummary, Month, Transaction, Alert, SpendBreakdown, GEBudgetRow, Quarter, TimePeriodMode, DeptGEChange, CategoryChange, Insight } from "./types";
import { DEPARTMENT_MAP, DEPARTMENTS, MONTHS, QUARTERS, QUARTER_LIST } from "./constants";

export function getActualTotal(actuals: ActualsData, deptId: string, month: string): number {
  return actuals[deptId]?.[month]?.total ?? 0;
}

export function getBudgetAllocated(budgets: BudgetsData, deptId: string, month: string): number {
  return budgets[deptId]?.[month]?.allocated ?? 0;
}

export function calculateBudgetVsActual(
  budgets: BudgetsData,
  actuals: ActualsData,
  month: string
): BudgetVsActual[] {
  return DEPARTMENTS.map((dept) => {
    const allocated = getBudgetAllocated(budgets, dept.id, month);
    const actual = getActualTotal(actuals, dept.id, month);
    const variance = allocated - actual;
    const utilization = allocated > 0 ? (actual / allocated) * 100 : actual > 0 ? 999 : 0;
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      color: dept.color,
      allocated,
      actual,
      variance,
      utilization,
    };
  });
}

export function calculateKPISummary(
  budgets: BudgetsData,
  actuals: ActualsData,
  transactions: Transaction[],
  currentMonth: string,
  previousMonth?: string
): KPISummary {
  let totalBudget = 0;
  let totalSpend = 0;
  DEPARTMENTS.forEach((dept) => {
    totalBudget += getBudgetAllocated(budgets, dept.id, currentMonth);
    totalSpend += getActualTotal(actuals, dept.id, currentMonth);
  });
  const utilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const flaggedCount = transactions.filter((t) => t.flagged && t.month === currentMonth).length;

  let monthOverMonthChange = 0;
  if (previousMonth) {
    let prevSpend = 0;
    DEPARTMENTS.forEach((dept) => {
      prevSpend += getActualTotal(actuals, dept.id, previousMonth);
    });
    monthOverMonthChange = prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0;
  }

  return { totalBudget, totalSpend, utilization, flaggedCount, monthOverMonthChange };
}

export function getMonthlyTotals(
  budgets: BudgetsData,
  actuals: ActualsData,
  months: Month[]
): { month: Month; budget: number; actual: number }[] {
  return months.map((month) => {
    let budget = 0;
    let actual = 0;
    DEPARTMENTS.forEach((dept) => {
      budget += getBudgetAllocated(budgets, dept.id, month);
      actual += getActualTotal(actuals, dept.id, month);
    });
    return { month, budget, actual };
  });
}

export function getDepartmentTotals(
  actuals: ActualsData,
  month: string
): { name: string; value: number; color: string }[] {
  return DEPARTMENTS.map((dept) => ({
    name: dept.name,
    value: getActualTotal(actuals, dept.id, month),
    color: dept.color,
  })).filter((d) => d.value > 0);
}

export function generateAlerts(
  budgets: BudgetsData,
  actuals: ActualsData,
  transactions: Transaction[],
  month: string
): Alert[] {
  const alerts: Alert[] = [];
  const bva = calculateBudgetVsActual(budgets, actuals, month);

  bva.forEach((item) => {
    if (item.utilization > 100) {
      alerts.push({
        id: `over-${item.departmentId}`,
        type: "over_budget",
        title: `${item.departmentName} over budget`,
        description: `${item.utilization.toFixed(0)}% utilized ($${(item.actual - item.allocated).toFixed(0)} over)`,
        severity: "high",
        departmentId: item.departmentId,
        timestamp: new Date().toISOString(),
      });
    } else if (item.utilization > 90) {
      alerts.push({
        id: `warn-${item.departmentId}`,
        type: "over_budget",
        title: `${item.departmentName} approaching limit`,
        description: `${item.utilization.toFixed(0)}% of budget utilized`,
        severity: "medium",
        departmentId: item.departmentId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  transactions
    .filter((t) => t.flagged && t.month === month)
    .forEach((t) => {
      alerts.push({
        id: `flag-${t.id}`,
        type: "flagged_transaction",
        title: `Flagged: ${t.description.slice(0, 50)}`,
        description: `$${t.amount.toLocaleString()} - ${DEPARTMENT_MAP[t.department]?.name ?? t.department}`,
        severity: "high",
        departmentId: t.department,
        transactionId: t.id,
        timestamp: t.date,
      });
    });

  return alerts.sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

export function getTransactionsForDepartmentMonth(
  transactions: Transaction[],
  deptId: string,
  month: string
): Transaction[] {
  return transactions.filter((t) => t.department === deptId && t.month === month);
}

// ─── Time Period Helpers ─────────────────────────────────────

/** Get months for a given period */
export function getMonthsForPeriod(mode: TimePeriodMode, value: string): Month[] {
  if (mode === "month") return [value as Month];
  if (mode === "quarter") return QUARTERS[value as Quarter] ?? [];
  // YTD: all months
  return [...MONTHS];
}

/** Get previous period for comparison */
export function getPreviousPeriod(mode: TimePeriodMode, value: string): { mode: TimePeriodMode; value: string } | null {
  if (mode === "month") {
    const idx = MONTHS.indexOf(value as Month);
    return idx > 0 ? { mode: "month", value: MONTHS[idx - 1] } : null;
  }
  if (mode === "quarter") {
    const idx = QUARTER_LIST.indexOf(value as Quarter);
    return idx > 0 ? { mode: "quarter", value: QUARTER_LIST[idx - 1] } : null;
  }
  return null; // YTD has no previous
}

// ─── HC / GE Aggregation ─────────────────────────────────────

/** Aggregate actuals over multiple months for a department */
export function aggregateActuals(actuals: ActualsData, deptId: string, months: Month[]): SpendBreakdown {
  let hc = 0, ge = 0;
  for (const m of months) {
    const d = actuals[deptId]?.[m];
    if (d) { hc += d.humanCapital; ge += d.generalExpense; }
  }
  return { humanCapital: hc, generalExpense: ge, total: hc + ge };
}

/** Aggregate budgets over multiple months for a department */
export function aggregateBudgets(budgets: BudgetsData, deptId: string, months: Month[]): { allocated: number; hc: number; ge: number } {
  let allocated = 0, hc = 0, ge = 0;
  for (const m of months) {
    const d = budgets[deptId]?.[m];
    if (d) { allocated += d.allocated; hc += d.humanCapital; ge += d.generalExpense; }
  }
  return { allocated, hc, ge };
}

/** Company-wide spend breakdown for a period */
export function getCompanySpendBreakdown(actuals: ActualsData, months: Month[]): SpendBreakdown {
  let hc = 0, ge = 0;
  DEPARTMENTS.forEach((dept) => {
    const d = aggregateActuals(actuals, dept.id, months);
    hc += d.humanCapital;
    ge += d.generalExpense;
  });
  return { humanCapital: hc, generalExpense: ge, total: hc + ge };
}

/** Company-wide budget totals for a period */
export function getCompanyBudgetTotals(budgets: BudgetsData, months: Month[]): { allocated: number; hc: number; ge: number } {
  let allocated = 0, hc = 0, ge = 0;
  DEPARTMENTS.forEach((dept) => {
    const d = aggregateBudgets(budgets, dept.id, months);
    allocated += d.allocated;
    hc += d.hc;
    ge += d.ge;
  });
  return { allocated, hc, ge };
}

/** GE-focused budget vs actual per department (what departments control) */
export function calculateGEBudgetRows(budgets: BudgetsData, actuals: ActualsData, months: Month[]): GEBudgetRow[] {
  return DEPARTMENTS.map((dept) => {
    const bud = aggregateBudgets(budgets, dept.id, months);
    const act = aggregateActuals(actuals, dept.id, months);
    const geVariance = bud.ge - act.generalExpense;
    const geUtilization = bud.ge > 0 ? (act.generalExpense / bud.ge) * 100 : act.generalExpense > 0 ? 999 : 0;
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      color: dept.color,
      lead: dept.lead,
      geBudget: bud.ge,
      geActual: act.generalExpense,
      geVariance,
      geUtilization,
      hcActual: act.humanCapital,
      totalActual: act.total,
    };
  });
}

/** Monthly HC/GE breakdown for trend charts */
export function getMonthlyHCGETrend(
  budgets: BudgetsData,
  actuals: ActualsData,
  months: Month[]
): { month: Month; hc: number; ge: number; total: number; budget: number; geBudget: number }[] {
  return months.map((month) => {
    let hc = 0, ge = 0, budget = 0, geBudget = 0;
    DEPARTMENTS.forEach((dept) => {
      const a = actuals[dept.id]?.[month];
      const b = budgets[dept.id]?.[month];
      if (a) { hc += a.humanCapital; ge += a.generalExpense; }
      if (b) { budget += b.allocated; geBudget += b.generalExpense; }
    });
    return { month, hc, ge, total: hc + ge, budget, geBudget };
  });
}

/** GE alerts only (departments don't control HC) */
export function generateGEAlerts(budgets: BudgetsData, actuals: ActualsData, transactions: Transaction[], months: Month[]): Alert[] {
  const alerts: Alert[] = [];
  const rows = calculateGEBudgetRows(budgets, actuals, months);

  rows.forEach((row) => {
    if (row.geUtilization > 100) {
      alerts.push({
        id: `ge-over-${row.departmentId}`,
        type: "over_budget",
        title: `${row.departmentName} GE over budget`,
        description: `${row.geUtilization.toFixed(0)}% utilized ($${(row.geActual - row.geBudget).toFixed(0)} over)`,
        severity: "high",
        departmentId: row.departmentId,
        timestamp: new Date().toISOString(),
      });
    } else if (row.geUtilization > 85) {
      alerts.push({
        id: `ge-warn-${row.departmentId}`,
        type: "over_budget",
        title: `${row.departmentName} GE approaching limit`,
        description: `${row.geUtilization.toFixed(0)}% of GE budget utilized`,
        severity: "medium",
        departmentId: row.departmentId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Smart-flagged transactions in the period (same rules as dashboard)
  const flaggedItems = detectFlaggedTransactions(transactions, actuals, months);
  flaggedItems.forEach((f) => {
    alerts.push({
      id: `flag-${f.transaction.id}`,
      type: "flagged_transaction",
      title: `Flagged: ${f.transaction.description.slice(0, 50)}`,
      description: `$${f.transaction.amount.toLocaleString()} - ${DEPARTMENT_MAP[f.transaction.department]?.name ?? f.transaction.department}`,
      severity: f.severity === "critical" ? "high" : "medium",
      departmentId: f.transaction.department,
      transactionId: f.transaction.id,
      timestamp: f.transaction.date,
    });
  });

  return alerts.sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

/** Get transactions for a department over multiple months */
export function getTransactionsForDepartmentMonths(
  transactions: Transaction[],
  deptId: string,
  months: Month[]
): Transaction[] {
  const monthSet = new Set(months as string[]);
  return transactions.filter((t) => t.department === deptId && monthSet.has(t.month));
}

// ─── Period Change Analysis ─────────────────────────────────────

/** Department-level GE changes between two periods */
export function calculateDeptGEChanges(
  actuals: ActualsData,
  currentMonths: Month[],
  prevMonths: Month[]
): DeptGEChange[] {
  return DEPARTMENTS.map((dept) => {
    const curr = aggregateActuals(actuals, dept.id, currentMonths);
    const prev = aggregateActuals(actuals, dept.id, prevMonths);
    const change = curr.generalExpense - prev.generalExpense;
    const changePct = prev.generalExpense > 0 ? (change / prev.generalExpense) * 100 : 0;
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      color: dept.color,
      prevGE: prev.generalExpense,
      currentGE: curr.generalExpense,
      change,
      changePct,
    };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

/** Category-level GE changes between two periods */
export function getCategoryChanges(
  transactions: Transaction[],
  currentMonths: Month[],
  prevMonths: Month[]
): CategoryChange[] {
  const currSet = new Set(currentMonths as string[]);
  const prevSet = new Set(prevMonths as string[]);
  const currMap = new Map<string, number>();
  const prevMap = new Map<string, number>();

  transactions.filter((t) => t.type === "general-expense").forEach((t) => {
    if (currSet.has(t.month)) currMap.set(t.category, (currMap.get(t.category) ?? 0) + t.amount);
    if (prevSet.has(t.month)) prevMap.set(t.category, (prevMap.get(t.category) ?? 0) + t.amount);
  });

  const allCategories = new Set([...Array.from(currMap.keys()), ...Array.from(prevMap.keys())]);
  return Array.from(allCategories)
    .map((cat) => ({
      category: cat,
      current: currMap.get(cat) ?? 0,
      prev: prevMap.get(cat) ?? 0,
      change: (currMap.get(cat) ?? 0) - (prevMap.get(cat) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

/** Generate AI-style insights based on data patterns */
// ─── Smart Auto-Flagging Rules ──────────────────────────────────────────
// Returns transactions that SHOULD be flagged with reasons, combining manual flags + auto-detection
export interface FlaggedItem {
  transaction: Transaction;
  reasons: string[];
  severity: "critical" | "warning" | "info";
}

export function detectFlaggedTransactions(
  transactions: Transaction[],
  actuals: ActualsData,
  months: Month[]
): FlaggedItem[] {
  const monthSet = new Set(months as string[]);
  const periodTxns = transactions.filter((t) => monthSet.has(t.month) && t.type === "general-expense");
  const results: FlaggedItem[] = [];
  const seen = new Set<string>();

  // Build per-category average from historical data (all months before current period)
  const historicalMonths = MONTHS.filter((m) => !monthSet.has(m));
  const histCategoryAvg = new Map<string, { total: number; count: number }>();
  transactions
    .filter((t) => t.type === "general-expense" && historicalMonths.some((hm) => t.month === hm))
    .forEach((t) => {
      const entry = histCategoryAvg.get(t.category) ?? { total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      histCategoryAvg.set(t.category, entry);
    });

  // Build per-vendor spend history
  const vendorHistory = new Map<string, number[]>();
  transactions
    .filter((t) => t.type === "general-expense" && historicalMonths.some((hm) => t.month === hm))
    .forEach((t) => {
      const key = t.description.toLowerCase().trim();
      const arr = vendorHistory.get(key) ?? [];
      arr.push(t.amount);
      vendorHistory.set(key, arr);
    });

  for (const txn of periodTxns) {
    const reasons: string[] = [];
    let severity: "critical" | "warning" | "info" = "info";

    // Rule 1: Manually flagged
    if (txn.flagged) {
      reasons.push("Manually flagged for review");
      severity = "warning";
    }

    // Rule 2: High-value single GE transaction (> $8,000)
    if (txn.amount > 8000) {
      reasons.push(`High-value GE: $${txn.amount.toLocaleString()} exceeds $8K single-transaction threshold`);
      severity = txn.amount > 15000 ? "critical" : "warning";
    }

    // Rule 3: Vendor price spike — amount > 2x historical average for same vendor
    const vendorKey = txn.description.toLowerCase().trim();
    const vendorHist = vendorHistory.get(vendorKey);
    if (vendorHist && vendorHist.length >= 2) {
      const avgAmount = vendorHist.reduce((a, b) => a + b, 0) / vendorHist.length;
      if (txn.amount > avgAmount * 2 && txn.amount - avgAmount > 500) {
        reasons.push(`Vendor price spike: $${txn.amount.toLocaleString()} is ${(txn.amount / avgAmount).toFixed(1)}x the historical avg ($${Math.round(avgAmount).toLocaleString()}) for "${txn.description}"`);
        severity = severity === "info" ? "warning" : severity;
      }
    }

    // Rule 4: New vendor (first time seeing this vendor) with amount > $3,000
    if (!vendorHist && txn.amount > 3000) {
      reasons.push(`New vendor "${txn.description}" with first payment of $${txn.amount.toLocaleString()} — verify contract and approval`);
      severity = severity === "info" ? "warning" : severity;
    }

    // Rule 5: Category spending anomaly — single txn > 50% of historical monthly category average
    const catHist = histCategoryAvg.get(txn.category);
    if (catHist && catHist.count >= 3) {
      const monthlyAvg = catHist.total / historicalMonths.length;
      if (txn.amount > monthlyAvg * 0.5 && txn.amount > 2000) {
        reasons.push(`Single transaction is ${((txn.amount / monthlyAvg) * 100).toFixed(0)}% of the monthly "${txn.category}" average ($${Math.round(monthlyAvg).toLocaleString()}/mo)`);
      }
    }

    if (reasons.length > 0 && !seen.has(txn.id)) {
      seen.add(txn.id);
      results.push({ transaction: txn, reasons, severity });
    }
  }

  return results.sort((a, b) => {
    const sevOrder = { critical: 0, warning: 1, info: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity] || b.transaction.amount - a.transaction.amount;
  });
}

// ─── Deep AI Insights ───────────────────────────────────────────────────
export function generateInsights(
  budgets: BudgetsData,
  actuals: ActualsData,
  transactions: Transaction[],
  currentMonths: Month[],
  prevMonths: Month[]
): Insight[] {
  const insights: Insight[] = [];
  const geRows = calculateGEBudgetRows(budgets, actuals, currentMonths);
  const currentSpend = getCompanySpendBreakdown(actuals, currentMonths);
  const prevSpend = prevMonths.length > 0 ? getCompanySpendBreakdown(actuals, prevMonths) : null;
  const budgetTotals = getCompanyBudgetTotals(budgets, currentMonths);
  const monthSet = new Set(currentMonths as string[]);
  const prevMonthSet = new Set(prevMonths as string[]);

  // ── 1. Budget Overrun Analysis ──
  const overBudgetDepts = geRows.filter((r) => r.geUtilization > 100);
  if (overBudgetDepts.length > 0) {
    overBudgetDepts.forEach((d) => {
      const overBy = d.geActual - d.geBudget;
      // Find what categories drove the overrun
      const deptTxns = transactions.filter(
        (t) => t.department === d.departmentId && monthSet.has(t.month) && t.type === "general-expense"
      );
      const catTotals = new Map<string, number>();
      deptTxns.forEach((t) => catTotals.set(t.category, (catTotals.get(t.category) ?? 0) + t.amount));
      const topCats = Array.from(catTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);
      const catDetail = topCats.map(([cat, amt]) => `${cat} $${Math.round(amt).toLocaleString()}`).join(", ");

      insights.push({
        type: "warning",
        text: `${d.departmentName} GE 超出预算 $${Math.round(overBy).toLocaleString()}（${d.geUtilization.toFixed(0)}%）。主要支出：${catDetail}。建议与部门负责人确认是否有未预期的大额支出，或需要调整下月预算。`,
      });
    });
  }

  // ── 2. MoM Department Change Drill-Down ──
  if (prevMonths.length > 0) {
    const deptChanges = calculateDeptGEChanges(actuals, currentMonths, prevMonths);
    deptChanges.forEach((d) => {
      if (Math.abs(d.changePct) > 20 && Math.abs(d.change) > 1000) {
        // Find what categories drove the change
        const currTxns = transactions.filter(
          (t) => t.department === d.departmentId && monthSet.has(t.month) && t.type === "general-expense"
        );
        const prevTxns = transactions.filter(
          (t) => t.department === d.departmentId && prevMonthSet.has(t.month) && t.type === "general-expense"
        );

        const currCats = new Map<string, number>();
        const prevCats = new Map<string, number>();
        currTxns.forEach((t) => currCats.set(t.category, (currCats.get(t.category) ?? 0) + t.amount));
        prevTxns.forEach((t) => prevCats.set(t.category, (prevCats.get(t.category) ?? 0) + t.amount));

        const allCats = new Set([...Array.from(currCats.keys()), ...Array.from(prevCats.keys())]);
        const catDiffs: { cat: string; diff: number }[] = [];
        allCats.forEach((cat) => {
          const diff = (currCats.get(cat) ?? 0) - (prevCats.get(cat) ?? 0);
          if (Math.abs(diff) > 500) catDiffs.push({ cat, diff });
        });
        catDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

        const dir = d.change > 0 ? "上升" : "下降";
        const driverDetail = catDiffs.slice(0, 3).map((c) =>
          `${c.cat} ${c.diff > 0 ? "+" : ""}$${Math.round(c.diff).toLocaleString()}`
        ).join("；");

        insights.push({
          type: d.change > 0 ? "warning" : "info",
          text: `${d.departmentName} GE 环比${dir} ${Math.abs(d.changePct).toFixed(0)}%（$${Math.round(d.prevGE).toLocaleString()} → $${Math.round(d.currentGE).toLocaleString()}）。驱动因素：${driverDetail || "多个小额变动"}。${d.change > 0 ? "建议关注是否为一次性支出或持续性增长趋势。" : ""}`,
        });
      }
    });

    // ── 3. Category-Level Anomalies ──
    const catChanges = getCategoryChanges(transactions, currentMonths, prevMonths);
    const significantCatChanges = catChanges.filter((c) => Math.abs(c.change) > 3000);
    significantCatChanges.slice(0, 2).forEach((c) => {
      const pct = c.prev > 0 ? ((c.change / c.prev) * 100).toFixed(0) : "N/A";
      if (c.change > 0) {
        insights.push({
          type: "warning",
          text: `"${c.category}" 类别支出环比增加 $${Math.round(c.change).toLocaleString()}（${pct}%），从 $${Math.round(c.prev).toLocaleString()} 增至 $${Math.round(c.current).toLocaleString()}。需要确认是否在预期范围内。`,
        });
      } else {
        insights.push({
          type: "success",
          text: `"${c.category}" 类别支出环比减少 $${Math.round(Math.abs(c.change)).toLocaleString()}（${pct}%），成本控制效果显著。`,
        });
      }
    });
  }

  // ── 4. Flagged Transaction Summary ──
  const flaggedItems = detectFlaggedTransactions(transactions, actuals, currentMonths);
  const criticalFlags = flaggedItems.filter((f) => f.severity === "critical");
  const warningFlags = flaggedItems.filter((f) => f.severity === "warning");
  if (criticalFlags.length > 0) {
    const details = criticalFlags.slice(0, 3).map((f) =>
      `${f.transaction.description} $${f.transaction.amount.toLocaleString()}（${f.reasons[0]}）`
    ).join("；");
    insights.push({
      type: "warning",
      text: `${criticalFlags.length} 笔高风险交易需要立即审核：${details}`,
    });
  }
  if (warningFlags.length > criticalFlags.length) {
    const nonCritical = warningFlags.length - criticalFlags.length;
    insights.push({
      type: "info",
      text: `另有 ${nonCritical} 笔交易触发自动审核规则（新供应商首次付款、价格异常波动等），建议在 Budget 页面逐项确认。`,
    });
  }

  // ── 5. Budget Optimization Opportunities ──
  const underUtilized = geRows.filter((r) => r.geUtilization < 50 && r.geBudget > 3000);
  if (underUtilized.length > 0) {
    const totalUnused = underUtilized.reduce((s, d) => s + (d.geBudget - d.geActual), 0);
    const deptNames = underUtilized.map((d) => `${d.departmentName}（${d.geUtilization.toFixed(0)}%）`).join("、");
    insights.push({
      type: "optimization",
      text: `${deptNames} GE 使用率偏低，合计 $${Math.round(totalUnused).toLocaleString()} 预算未使用。可以考虑：1）将闲置预算重新分配给超支部门；2）下调预算以降低月均 burn rate，延长 runway。`,
    });
  }

  // ── 6. HC Trend Analysis ──
  if (prevSpend && prevSpend.humanCapital > 0) {
    const hcChange = ((currentSpend.humanCapital - prevSpend.humanCapital) / prevSpend.humanCapital) * 100;
    const hcDelta = currentSpend.humanCapital - prevSpend.humanCapital;
    if (hcChange > 5) {
      // Identify which departments drove HC increase
      const hcDrivers: string[] = [];
      DEPARTMENTS.forEach((dept) => {
        const curr = aggregateActuals(actuals, dept.id, currentMonths).humanCapital;
        const prev = aggregateActuals(actuals, dept.id, prevMonths).humanCapital;
        const diff = curr - prev;
        if (diff > 1000) hcDrivers.push(`${dept.name} +$${Math.round(diff).toLocaleString()}`);
      });
      insights.push({
        type: "warning",
        text: `人力成本环比上升 ${hcChange.toFixed(1)}%（+$${Math.round(hcDelta).toLocaleString()}）。${hcDrivers.length > 0 ? `主要来自：${hcDrivers.join("、")}。` : ""}建议确认是否有新入职、调薪或奖金发放。HC 是最大支出项（占总支出 ${((currentSpend.humanCapital / (currentSpend.humanCapital + currentSpend.generalExpense)) * 100).toFixed(0)}%），需持续关注。`,
      });
    } else if (hcChange < -5) {
      insights.push({
        type: "info",
        text: `人力成本环比下降 ${Math.abs(hcChange).toFixed(1)}%（-$${Math.round(Math.abs(hcDelta)).toLocaleString()}）。可能原因：人员离职、薪资结构调整或发放时间差异。`,
      });
    } else {
      insights.push({
        type: "success",
        text: `人力成本稳定（环比 ${hcChange > 0 ? "+" : ""}${hcChange.toFixed(1)}%），占总支出 ${((currentSpend.humanCapital / (currentSpend.humanCapital + currentSpend.generalExpense)) * 100).toFixed(0)}%。`,
      });
    }
  }

  // ── 7. Burn Rate & Runway Warning ──
  const totalMonthlyBurn = currentSpend.humanCapital + currentSpend.generalExpense;
  const totalMonthlyBudget = budgetTotals.hc + budgetTotals.ge;
  const burnVsBudget = totalMonthlyBudget > 0 ? ((totalMonthlyBurn / totalMonthlyBudget) * 100) : 0;
  if (burnVsBudget > 95) {
    insights.push({
      type: "warning",
      text: `本期实际 burn $${Math.round(totalMonthlyBurn).toLocaleString()} 接近预算上限（${burnVsBudget.toFixed(0)}%）。如果持续超支，runway 将缩短。建议审视非必要 GE 支出。`,
    });
  } else if (burnVsBudget < 75) {
    insights.push({
      type: "success",
      text: `本期实际 burn $${Math.round(totalMonthlyBurn).toLocaleString()}，预算使用 ${burnVsBudget.toFixed(0)}%，burn rate 控制良好。`,
    });
  }

  return insights;
}
