import { ActualsData, BudgetsData, BudgetVsActual, KPISummary, Month, Transaction, Alert, SpendBreakdown, GEBudgetRow, Quarter, TimePeriodMode } from "./types";
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
  const flaggedCount = transactions.filter((t) => t.flagged).length;

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

  // Flagged transactions in the period
  const monthSet = new Set(months as string[]);
  transactions
    .filter((t) => t.flagged && monthSet.has(t.month))
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

/** Get transactions for a department over multiple months */
export function getTransactionsForDepartmentMonths(
  transactions: Transaction[],
  deptId: string,
  months: Month[]
): Transaction[] {
  const monthSet = new Set(months as string[]);
  return transactions.filter((t) => t.department === deptId && monthSet.has(t.month));
}
