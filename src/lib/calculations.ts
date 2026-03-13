import { ActualSpend, BudgetAllocation, BudgetVsActual, KPISummary, Month, DepartmentId, Transaction, Alert } from "./types";
import { DEPARTMENT_MAP, DEPARTMENTS } from "./constants";

export function getActualsByDepartmentMonth(
  actuals: ActualSpend[],
  departmentId: DepartmentId,
  month: Month
): number {
  return actuals
    .filter((a) => a.departmentId === departmentId && a.month === month)
    .reduce((sum, a) => sum + a.amount, 0);
}

export function getBudgetForDepartmentMonth(
  budgets: BudgetAllocation[],
  departmentId: DepartmentId,
  month: Month
): number {
  const entry = budgets.find((b) => b.departmentId === departmentId && b.month === month);
  return entry?.allocated ?? 0;
}

export function calculateBudgetVsActual(
  budgets: BudgetAllocation[],
  actuals: ActualSpend[],
  month: Month
): BudgetVsActual[] {
  return DEPARTMENTS.map((dept) => {
    const allocated = getBudgetForDepartmentMonth(budgets, dept.id, month);
    const actual = getActualsByDepartmentMonth(actuals, dept.id, month);
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
  budgets: BudgetAllocation[],
  actuals: ActualSpend[],
  transactions: Transaction[],
  currentMonth: Month,
  previousMonth?: Month
): KPISummary {
  const totalBudget = budgets
    .filter((b) => b.month === currentMonth)
    .reduce((sum, b) => sum + b.allocated, 0);
  const totalSpend = actuals
    .filter((a) => a.month === currentMonth)
    .reduce((sum, a) => sum + a.amount, 0);
  const utilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
  const flaggedCount = transactions.filter((t) => t.status === "flagged").length;

  let monthOverMonthChange = 0;
  if (previousMonth) {
    const prevSpend = actuals
      .filter((a) => a.month === previousMonth)
      .reduce((sum, a) => sum + a.amount, 0);
    monthOverMonthChange = prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0;
  }

  return { totalBudget, totalSpend, utilization, flaggedCount, monthOverMonthChange };
}

export function getMonthlyTotals(
  budgets: BudgetAllocation[],
  actuals: ActualSpend[],
  months: Month[]
): { month: Month; budget: number; actual: number }[] {
  return months.map((month) => ({
    month,
    budget: budgets.filter((b) => b.month === month).reduce((s, b) => s + b.allocated, 0),
    actual: actuals.filter((a) => a.month === month).reduce((s, a) => s + a.amount, 0),
  }));
}

export function getDepartmentTotals(
  actuals: ActualSpend[],
  month: Month
): { name: string; value: number; color: string }[] {
  return DEPARTMENTS.map((dept) => ({
    name: dept.name,
    value: getActualsByDepartmentMonth(actuals, dept.id, month),
    color: dept.color,
  })).filter((d) => d.value > 0);
}

export function generateAlerts(
  budgets: BudgetAllocation[],
  actuals: ActualSpend[],
  transactions: Transaction[],
  month: Month
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
    .filter((t) => t.status === "flagged")
    .forEach((t) => {
      alerts.push({
        id: `flag-${t.id}`,
        type: "flagged_transaction",
        title: `Flagged: ${t.description}`,
        description: `$${t.amount.toLocaleString()} - ${DEPARTMENT_MAP[t.departmentId]?.name}`,
        severity: "high",
        departmentId: t.departmentId,
        timestamp: t.date,
      });
    });

  transactions
    .filter((t) => t.status === "pending")
    .forEach((t) => {
      alerts.push({
        id: `pend-${t.id}`,
        type: "pending_approval",
        title: `Pending: ${t.description}`,
        description: `$${t.amount.toLocaleString()} awaiting approval`,
        severity: "low",
        departmentId: t.departmentId,
        timestamp: t.date,
      });
    });

  return alerts.sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}
