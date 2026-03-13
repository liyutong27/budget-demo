import Anthropic from "@anthropic-ai/sdk";
import { DashboardData, FinancialAnalysis } from "./types";
import { DEPARTMENTS, MONTHS, MONTH_LABELS } from "./constants";

// In-memory cache (1 hour TTL)
const analysisCache = new Map<string, { data: FinancialAnalysis; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

function getCached(key: string): FinancialAnalysis | null {
  const entry = analysisCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function buildPromptData(data: DashboardData, month: string): string {
  const { budgets, actuals, transactions, treasury } = data;
  const prevMonth = MONTHS[MONTHS.indexOf(month as any) - 1] ?? null;

  // GE Budget vs Actual per department
  const geTable = DEPARTMENTS.map((d) => {
    const budget = budgets[d.id]?.[month]?.generalExpense ?? 0;
    const actual = actuals[d.id]?.[month]?.generalExpense ?? 0;
    const prevActual = prevMonth ? (actuals[d.id]?.[prevMonth]?.generalExpense ?? 0) : 0;
    const util = budget > 0 ? ((actual / budget) * 100).toFixed(0) : "N/A";
    const momChange = prevActual > 0 ? (((actual - prevActual) / prevActual) * 100).toFixed(1) : "N/A";
    return `${d.name}: budget=$${budget.toLocaleString()} actual=$${actual.toLocaleString()} util=${util}% MoM=${momChange}%`;
  }).join("\n");

  // HC per department
  const hcTable = DEPARTMENTS.map((d) => {
    const actual = actuals[d.id]?.[month]?.humanCapital ?? 0;
    const prevActual = prevMonth ? (actuals[d.id]?.[prevMonth]?.humanCapital ?? 0) : 0;
    const change = prevActual > 0 ? (((actual - prevActual) / prevActual) * 100).toFixed(1) : "N/A";
    return `${d.name}: HC=$${actual.toLocaleString()} MoM=${change}%`;
  }).join("\n");

  // Total spend trend (last 3 months)
  const last3 = MONTHS.slice(-3);
  const trendTable = last3.map((m) => {
    let total = 0;
    DEPARTMENTS.forEach((d) => { total += actuals[d.id]?.[m]?.total ?? 0; });
    return `${MONTH_LABELS[m]}: $${total.toLocaleString()}`;
  }).join("\n");

  // Top GE transactions this month
  const monthTxns = (transactions || [])
    .filter((t: any) => t.month === month && t.type === "general-expense")
    .sort((a: any, b: any) => b.amount - a.amount)
    .slice(0, 10);
  const txnTable = monthTxns.map((t: any) =>
    `$${t.amount.toLocaleString()} | ${t.description} | ${t.department} | ${t.category}${t.flagged ? " [FLAGGED]" : ""}`
  ).join("\n");

  // Flagged transactions
  const flagged = (transactions || [])
    .filter((t: any) => t.month === month && t.flagged);
  const flaggedTable = flagged.length > 0
    ? flagged.map((t: any) => `$${t.amount.toLocaleString()} | ${t.description} | ${t.department}`).join("\n")
    : "None";

  // Treasury & runway
  const treasuryBalance = treasury?.totals?.[month] ?? 0;
  const totalBurn = last3.reduce((sum, m) => {
    let total = 0;
    DEPARTMENTS.forEach((d) => { total += actuals[d.id]?.[m]?.total ?? 0; });
    return sum + total;
  }, 0);
  const avgBurn = totalBurn / last3.length;
  const runway = avgBurn > 0 ? (treasuryBalance / avgBurn) : 0;

  return `=== CURRENT PERIOD: ${MONTH_LABELS[month as keyof typeof MONTH_LABELS] ?? month} ===

=== DEPARTMENTS ===
${DEPARTMENTS.map((d) => `${d.name} (${d.id}) - Lead: ${d.lead}`).join("\n")}

=== GE BUDGET vs ACTUAL ===
${geTable}

=== HC BY DEPARTMENT ===
${hcTable}

=== SPEND TREND (Last 3 Months) ===
${trendTable}

=== TOP 10 GE TRANSACTIONS ===
${txnTable}

=== FLAGGED TRANSACTIONS ===
${flaggedTable}

=== TREASURY & RUNWAY ===
Treasury Balance: $${treasuryBalance.toLocaleString()}
Avg Monthly Burn (3mo): $${avgBurn.toLocaleString()}
Runway: ${runway.toFixed(1)} months (${(runway / 12).toFixed(1)} years)`;
}

export async function generateFinancialAnalysis(
  data: DashboardData,
  period: string
): Promise<FinancialAnalysis> {
  // Check cache
  const cacheKey = `analysis-${period}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });

  const promptData = buildPromptData(data, period);

  const systemPrompt = `你是一位资深的创业公司财务分析师，正在为 Donut Protocol（一家 Web3/Crypto 创业公司）进行月度预算分析。

请分析以下财务数据，提供深度、具体、可执行的分析。不要只重复数字，而是要：
- 找出异常模式和潜在风险
- 给出具体的优化建议（精确到部门和金额）
- 预警需要关注的趋势
- 对比行业标准给出评价

用中文回复，使用以下 JSON 格式：
{
  "summary": "2-3句话的执行摘要，突出最重要的发现",
  "anomalies": [
    { "type": "warning", "title": "简短标题", "text": "具体分析和数据支持", "severity": "high|medium|low" }
  ],
  "optimizations": [
    { "type": "optimization", "title": "优化建议标题", "text": "具体可执行的建议，包含预估节省金额", "severity": "high|medium|low" }
  ],
  "trends": [
    { "type": "info|warning|success", "title": "趋势标题", "text": "趋势分析和预测" }
  ],
  "departmentInsights": [
    { "departmentId": "tech|gtm|design|product|operations", "departmentName": "部门名", "insight": "该部门的具体分析" }
  ]
}

重要：
- anomalies 至少 2-3 条，聚焦真正的异常而非正常波动
- optimizations 至少 2-3 条，每条必须有具体数字和行动建议
- departmentInsights 每个部门都要有
- severity 要准确反映紧急程度
- 只输出 JSON，不要包含其他文字`;

  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        { role: "user", content: promptData },
      ],
      system: systemPrompt,
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const analysis: FinancialAnalysis = {
      ...JSON.parse(jsonStr),
      generatedAt: new Date().toISOString(),
    };

    // Cache result
    analysisCache.set(cacheKey, { data: analysis, ts: Date.now() });
    return analysis;
  } catch (err: any) {
    console.error("[claude-analysis] API error:", err);
    throw new Error(`Claude API error: ${err.message}`);
  }
}
