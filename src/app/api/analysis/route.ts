import { NextRequest, NextResponse } from "next/server";
import { fetchDashboardData } from "@/lib/data-fetcher";
import { generateFinancialAnalysis } from "@/lib/claude-analysis";
import { MONTHS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow up to 30s for Claude API

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 501 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const period = body.period || MONTHS[MONTHS.length - 1];

    const data = await fetchDashboardData();
    const analysis = await generateFinancialAnalysis(data, period);

    return NextResponse.json(analysis);
  } catch (err: any) {
    console.error("[api/analysis] Error:", err);
    return NextResponse.json(
      { error: err.message ?? "Analysis failed" },
      { status: 500 }
    );
  }
}
