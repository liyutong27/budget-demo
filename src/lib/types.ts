export type Month =
  | "may-2025" | "jun-2025" | "jul-2025" | "aug-2025"
  | "sep-2025" | "oct-2025" | "nov-2025" | "dec-2025"
  | "jan-2026" | "feb-2026";

export type DepartmentId = "tech" | "gtm" | "design" | "product" | "operations";

export interface Department {
  id: string;
  name: string;
  color: string;
  lead: string;
}

export interface Transaction {
  id: string;
  date: string;
  month: string;
  department: string;
  category: string;
  subcategory: string;
  description: string;
  applicant: string;
  paymentType: string;
  currency: string;
  amount: number;
  type: "general-expense" | "human-capital";
  status: "approved" | "pending" | "flagged" | "rejected";
  flagged: boolean;
}

export interface ActualsData {
  [deptId: string]: {
    [month: string]: {
      humanCapital: number;
      generalExpense: number;
      total: number;
    };
  };
}

export interface BudgetsData {
  [deptId: string]: {
    [month: string]: {
      allocated: number;
      humanCapital: number;
      generalExpense: number;
    };
  };
}

export interface BudgetVsActual {
  departmentId: string;
  departmentName: string;
  color: string;
  allocated: number;
  actual: number;
  variance: number;
  utilization: number;
}

export interface KPISummary {
  totalBudget: number;
  totalSpend: number;
  utilization: number;
  flaggedCount: number;
  monthOverMonthChange: number;
}

export interface Alert {
  id: string;
  type: "over_budget" | "flagged_transaction" | "pending_approval";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  departmentId?: string;
  timestamp: string;
  transactionId?: string;
}

export interface CloseCheck {
  id: number;
  label: string;
  description: string;
  status: "not_started" | "in_progress" | "completed";
  assignee?: string;
  completedAt?: string;
}

export interface CloseMonth {
  month: Month;
  checks: CloseCheck[];
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  reportType: "monthly_summary" | "budget_alert" | "pl_statement";
  includeCharts: boolean;
}

export type Role = "admin" | "finance" | "dept_lead" | "viewer";

// Time period types
export type Quarter = "Q2-2025" | "Q3-2025" | "Q4-2025" | "Q1-2026";
export type TimePeriodMode = "month" | "quarter" | "ytd";

export interface SpendBreakdown {
  humanCapital: number;
  generalExpense: number;
  total: number;
}

export interface GEBudgetRow {
  departmentId: string;
  departmentName: string;
  color: string;
  lead: string;
  geBudget: number;
  geActual: number;
  geVariance: number;
  geUtilization: number;
  hcActual: number;
  totalActual: number;
}
