import { Department, DepartmentId, Month } from "./types";

export const MONTHS: Month[] = [
  "2025-05", "2025-06", "2025-07", "2025-08",
  "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02",
];

export const MONTH_LABELS: Record<Month, string> = {
  "2025-05": "May 2025",
  "2025-06": "Jun 2025",
  "2025-07": "Jul 2025",
  "2025-08": "Aug 2025",
  "2025-09": "Sep 2025",
  "2025-10": "Oct 2025",
  "2025-11": "Nov 2025",
  "2025-12": "Dec 2025",
  "2026-01": "Jan 2026",
  "2026-02": "Feb 2026",
};

export const DEPARTMENTS: Department[] = [
  { id: "aws-infrastructure", name: "AWS & Infrastructure", color: "#3b82f6", lead: "Alex Chen" },
  { id: "community", name: "Community", color: "#8b5cf6", lead: "Sarah Kim" },
  { id: "credit-card-subscription", name: "Credit Card & Subscription", color: "#f59e0b", lead: "Mike Liu" },
  { id: "design", name: "Design", color: "#ec4899", lead: "Lisa Park" },
  { id: "gtm", name: "GTM", color: "#14b8a6", lead: "David Wang" },
  { id: "internal-operation", name: "Internal Operation", color: "#6366f1", lead: "Jenny Zhang" },
  { id: "product", name: "Product", color: "#f97316", lead: "Tom Wu" },
  { id: "tech", name: "Tech", color: "#06b6d4", lead: "Kevin Li" },
];

export const DEPARTMENT_MAP: Record<DepartmentId, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, d])
) as Record<DepartmentId, Department>;

export const CHART_COLORS = {
  budget: "#3b82f6",
  actual: "#10b981",
  over: "#ef4444",
  warning: "#f59e0b",
  usdt: "#26a17b",
  muted: "#94a3b8",
};

export const CLOSE_CHECKS_TEMPLATE = [
  { label: "Review all transactions", description: "Verify all transactions for the month are recorded and categorized" },
  { label: "Verify categorization", description: "Ensure all expenses are assigned to the correct department and category" },
  { label: "Resolve flagged transactions", description: "Review and resolve any flagged or suspicious transactions" },
  { label: "Reconcile crypto wallets", description: "Match on-chain USDT transfers with recorded transactions" },
  { label: "Verify credit card statements", description: "Reconcile credit card charges with recorded expenses" },
  { label: "Department lead sign-off", description: "Obtain approval from each department lead on their spend" },
  { label: "Generate P&L statement", description: "Produce the monthly Profit & Loss statement" },
  { label: "Final approval", description: "CFO/CEO final sign-off on the month-end close" },
];
