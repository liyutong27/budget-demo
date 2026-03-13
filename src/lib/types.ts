export type Month =
  | "2025-05" | "2025-06" | "2025-07" | "2025-08"
  | "2025-09" | "2025-10" | "2025-11" | "2025-12"
  | "2026-01" | "2026-02";

export type DepartmentId =
  | "aws-infrastructure"
  | "community"
  | "credit-card-subscription"
  | "design"
  | "gtm"
  | "internal-operation"
  | "product"
  | "tech";

export type ExpenseCategory =
  | "Daily Tech Usage"
  | "Community"
  | "Event"
  | "Credit Card-subscription"
  | "Reimbursement"
  | "Travel Business"
  | "KOL"
  | "Legal";

export type PaymentType = "crypto_wallet" | "credit_card" | "bank_transfer" | "reimbursement";

export type TransactionStatus = "approved" | "pending" | "flagged" | "rejected";

export type CloseCheckStatus = "not_started" | "in_progress" | "completed";

export type Role = "admin" | "finance" | "dept_lead" | "viewer";

export interface Department {
  id: DepartmentId;
  name: string;
  color: string;
  lead: string;
}

export interface BudgetAllocation {
  departmentId: DepartmentId;
  month: Month;
  allocated: number;
  notes?: string;
}

export interface ActualSpend {
  departmentId: DepartmentId;
  month: Month;
  category: ExpenseCategory;
  amount: number;
}

export interface Transaction {
  id: string;
  date: string;
  departmentId: DepartmentId;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentType: PaymentType;
  status: TransactionStatus;
  vendor?: string;
}

export interface PLEntry {
  category: string;
  subCategory: string;
  monthly: Record<Month, number>;
}

export interface CloseCheck {
  id: number;
  label: string;
  description: string;
  status: CloseCheckStatus;
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

export interface KPISummary {
  totalBudget: number;
  totalSpend: number;
  utilization: number;
  flaggedCount: number;
  monthOverMonthChange: number;
}

export interface BudgetVsActual {
  departmentId: DepartmentId;
  departmentName: string;
  color: string;
  allocated: number;
  actual: number;
  variance: number;
  utilization: number;
}

export interface Alert {
  id: string;
  type: "over_budget" | "flagged_transaction" | "pending_approval";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  departmentId?: DepartmentId;
  timestamp: string;
}
