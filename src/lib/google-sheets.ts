import { google } from "googleapis";
import { DashboardData, ActualsData, BudgetsData, Transaction } from "./types";

function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function getSheet() {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

async function readTab(tabName: string, range: string): Promise<string[][]> {
  const sheets = await getSheet();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!${range}`,
  });
  return (res.data.values ?? []).slice(1); // Skip header row
}

function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,]/g, "").trim();
  return parseFloat(cleaned) || 0;
}

function parseBoolean(val: string | undefined): boolean {
  return val?.toUpperCase() === "TRUE";
}

async function fetchTransactions(): Promise<Transaction[]> {
  const rows = await readTab("Transactions", "A:N");
  return rows.map((row) => ({
    id: row[0] ?? "",
    date: row[1] ?? "",
    month: row[2] ?? "",
    department: row[3] ?? "",
    category: row[4] ?? "",
    subcategory: row[5] ?? "",
    description: row[6] ?? "",
    applicant: row[7] ?? "",
    paymentType: row[8] ?? "",
    currency: row[9] ?? "USDT",
    amount: parseNumber(row[10]),
    type: (row[11] ?? "general-expense") as "general-expense" | "human-capital",
    status: (row[12] ?? "approved") as "approved" | "pending" | "flagged" | "rejected",
    flagged: parseBoolean(row[13]),
  }));
}

async function fetchActuals(): Promise<ActualsData> {
  const rows = await readTab("Actuals", "A:E");
  const result: ActualsData = {};
  rows.forEach((row) => {
    const dept = row[0] ?? "";
    const month = row[1] ?? "";
    if (!dept || !month) return;
    if (!result[dept]) result[dept] = {};
    result[dept][month] = {
      humanCapital: parseNumber(row[2]),
      generalExpense: parseNumber(row[3]),
      total: parseNumber(row[4]),
    };
  });
  return result;
}

async function fetchBudgets(): Promise<BudgetsData> {
  const rows = await readTab("Budgets", "A:E");
  const result: BudgetsData = {};
  rows.forEach((row) => {
    const dept = row[0] ?? "";
    const month = row[1] ?? "";
    if (!dept || !month) return;
    if (!result[dept]) result[dept] = {};
    result[dept][month] = {
      allocated: parseNumber(row[2]),
      humanCapital: parseNumber(row[3]),
      generalExpense: parseNumber(row[4]),
    };
  });
  return result;
}

async function fetchTreasury(): Promise<any> {
  const rows = await readTab("Treasury", "A:C");
  const accounts: any[] = [];
  const totals: Record<string, number> = {};
  rows.forEach((row) => {
    const account = row[0] ?? "";
    const month = row[1] ?? "";
    const balance = parseNumber(row[2]);
    if (account === "TOTAL") {
      totals[month] = balance;
    } else {
      let existing = accounts.find((a) => a.name === account);
      if (!existing) {
        existing = { name: account };
        accounts.push(existing);
      }
      existing[month] = balance;
    }
  });
  return { accounts, totals };
}

async function fetchPLStatement(): Promise<any> {
  const rows = await readTab("PL-Statement", "A:D");
  const result: any = {};
  rows.forEach((row) => {
    const section = row[0] ?? "";
    const lineItem = row[1] ?? "";
    const month = row[2] ?? "";
    const amount = parseNumber(row[3]);
    if (!section || !month) return;

    // Build nested structure: result.section.lineItem.month = amount
    const parts = section.split(".");
    let target = result;
    parts.forEach((part) => {
      if (!target[part]) target[part] = {};
      target = target[part];
    });
    if (!target[lineItem]) target[lineItem] = {};
    target[lineItem][month] = amount;
  });
  return result;
}

export async function fetchAllSheetData(): Promise<DashboardData> {
  const [transactions, actuals, budgets, treasury, plStatement] = await Promise.all([
    fetchTransactions(),
    fetchActuals(),
    fetchBudgets(),
    fetchTreasury(),
    fetchPLStatement(),
  ]);

  return { budgets, actuals, transactions, treasury, plStatement };
}
