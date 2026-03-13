import { NextResponse } from "next/server";
import { fetchDashboardData } from "@/lib/data-fetcher";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchDashboardData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    console.error("[api/data] Error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch data" },
      { status: 500 }
    );
  }
}
