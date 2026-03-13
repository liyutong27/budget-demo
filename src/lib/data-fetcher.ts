import { DashboardData } from "./types";

// Static JSON imports (fallback)
import budgetsData from "@/data/budgets.json";
import actualsData from "@/data/actuals.json";
import transactionsData from "@/data/transactions.json";
import treasuryData from "@/data/treasury.json";
import plData from "@/data/pl-statement.json";

export function isGoogleSheetsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SPREADSHEET_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

export async function fetchDashboardData(): Promise<DashboardData> {
  if (isGoogleSheetsConfigured()) {
    try {
      const { fetchAllSheetData } = await import("./google-sheets");
      return await fetchAllSheetData();
    } catch (err) {
      console.error("[data-fetcher] Google Sheets fetch failed, falling back to static JSON:", err);
    }
  }

  // Fallback to static JSON
  return {
    budgets: budgetsData as any,
    actuals: actualsData as any,
    transactions: transactionsData as any,
    treasury: treasuryData as any,
    plStatement: plData as any,
  };
}
