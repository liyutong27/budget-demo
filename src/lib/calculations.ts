import { ActualsData, BudgetsData, BudgetVsActual, KPISummary, Month, Transaction, Alert } from "./types";
import { DEPARTMENT_MAP, DEPARTMENTS, MONTHS } from "./constants";

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
