import { Department, Month, Quarter } from "./types";

export const MONTHS: Month[] = [
  "may-2025", "jun-2025", "jul-2025", "aug-2025",
  "sep-2025", "oct-2025", "nov-2025", "dec-2025",
  "jan-2026", "feb-2026",
];

export const MONTH_LABELS: Record<Month, string> = {
  "may-2025": "May 2025",
  "jun-2025": "Jun 2025",
  "jul-2025": "Jul 2025",
  "aug-2025": "Aug 2025",
  "sep-2025": "Sep 2025",
  "oct-2025": "Oct 2025",
  "nov-2025": "Nov 2025",
  "dec-2025": "Dec 2025",
  "jan-2026": "Jan 2026",
  "feb-2026": "Feb 2026",
};

import departmentsData from "@/data/departments.json";

export const DEPARTMENTS: Department[] = departmentsData;

export const DEPARTMENT_MAP: Record<string, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, d])
);

// Quarter definitions
export const QUARTERS: Record<Quarter, Month[]> = {
  "Q2-2025": ["may-2025", "jun-2025"],
  "Q3-2025": ["jul-2025", "aug-2025", "sep-2025"],
  "Q4-2025": ["oct-2025", "nov-2025", "dec-2025"],
  "Q1-2026": ["jan-2026", "feb-2026"],
};

export const QUARTER_LIST: Quarter[] = ["Q2-2025", "Q3-2025", "Q4-2025", "Q1-2026"];

export const QUARTER_LABELS: Record<Quarter, string> = {
  "Q2-2025": "Q2 2025",
  "Q3-2025": "Q3 2025",
  "Q4-2025": "Q4 2025",
  "Q1-2026": "Q1 2026",
};

export const CHART_COLORS = {
  budget: "#9997FF",
  actual: "#22c55e",
  over: "#ef4444",
  warning: "#eab308",
  usdt: "#26a17b",
  muted: "#6b6b9a",
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
