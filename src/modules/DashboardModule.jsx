import { useState, useMemo } from "react";
import { T } from "../constants/tokens.js";
import { normalize, matchProduct } from "../lib/utils.js";
import { GRADE_ORDER, GRADE_COLORS } from "../constants/crm.js";
import { getGrade } from "../constants/scoring.js";
import { useAI } from "../hooks/useAI.js";
import { Sel, Btn, Card, MetricCard, SectionLabel } from "../components/ui/index.jsx";

export default function DashboardModule({ influencers, products, snapshots }) {
  const [view, setView] = useState("product");   // "product" | "summary"
  const [selectedProd, setSelectedProd] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [generating, setGenerating] = useState(false);

  // 所有有合作记录的产品列表
  const activeProds = useMemo(() => {
    const skus = new Set(influencers.map(i => i.product).filter(Boolean));
    return products.filter(p => skus.has(p.internalName) || skus.has(p.sku));
  }, [influencers, products]);

  // 所有出现过的月份（从CRM评分日期提取 YYYY-MM）
  const allMonths = useMemo(() => {
    const months = new Set();
    influencers.forEach(inf => {
      if (inf.date) {
        const d = inf.date.replace(/\//g, "-");
        const parts = d.split("-");
        if (parts.length >= 2) {
          const y = parts[0].length === 2 ? "20" + parts[0] : parts[0];
          const m = parts[1].padStart(2, "0");
          months.add(`${y}-${m}`);
        }
      }
    });
    return [...months].sort().reverse();
  }, [influencers]);

  // ── 核心计算：按产品+月份/累计，计算各等级达人的人均出单 ─────────────────
  function calcGradeStats(prodSku, monthFilter) {
    // 找出该产品的所有合作达人
    const prodInfs = influencers.filter(inf => {
      return normalize(inf.product) === normalize(prodSku) ||
        normalize(inf.product).includes(normalize(prodSku)) ||
        normalize(prodSku).includes(normalize(inf.product));
    });

    // 如果有月份筛选，按周期过滤（上月15日～本月15日）
    let filteredInfs = prodInfs;
    if (monthFilter) {
      const [y, m] = monthFilter.split("-").map(Number);
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const start = `${py}-${String(pm).padStart(2,"0")}-15`;
      const end   = `${y}-${String(m).padStart(2,"0")}-15`;
      filteredInfs = prodInfs.filter(inf => {
        const d = inf.date ? inf.date.replace(/\//g, "-") : "";
        const parts = d.split("-");
        if (parts.length < 3) return false;
        const normed = (parts[0].length === 2 ? "20"+parts[0] : parts[0]) + "-" + parts[1].padStart(2,"0") + "-" + parts[2].padStart(2,"0");
        return normed >= start && normed < end;
      });
    }

    // 按等级分组，计算累计出单
    const stats = {};
    GRADE_ORDER.forEach(g => { stats[g] = { count: 0, totalOrders: 0, infs: [] }; });

    filteredInfs.forEach(inf => {
      const grade = inf.grade;
      if (!stats[grade]) return;
      // 该达人针对该产品的累计出单
      const vids = (inf.videoRecords || []).filter(v =>
        normalize(v.product) === normalize(prodSku) ||
        normalize(v.product).includes(normalize(prodSku)) ||
        normalize(prodSku).includes(normalize(v.product))
      );
      const orders = vids.reduce((a, v) => a + (v.orders || 0), 0);
      stats[grade].count++;
      stats[grade].totalOrders += orders;
      stats[grade].infs.push({ id: inf.influencerId, orders, date: inf.date });
    });

    GRADE_ORDER.forEach(g => {
      stats[g].avgOrders = stats[g].count > 0
        ? (stats[g].totalOrders / stats[g].count).toFixed(1)
        : null;
    });

    return stats;
  }

  const monthlyStats = useMemo(() =>
    selectedProd && selectedMonth ? calcGradeStats(selectedProd, selectedMonth) : null,
    [selectedProd, selectedMonth, influencers]
  );

  const cumulativeStats = useMemo(() =>
    selectedProd ? calcGradeStats(selectedProd, null) : null,
    [selectedProd, influencers]
  );

  // ── AI 报告 ───────────────────────────────────────────────────────────────
  async function genReport() {
    setGenerating(true);
    const gradeCount = {};
    GRADE_ORDER.forEach(g => { gradeCount[g] = influencers.filter(i => i.grade === g).length; });
    const gradeStr = GRADE_ORDER.filter(g => gradeCount[g] > 0).map(g => `${g}级${gradeCount[g]}人`).join("，");
    const topProds = products.filter(p => p.status === "主推款" || p.status === "爆款主推款").map(p => p.internalName).join("，") || "暂无";

    let prodStatsStr = "";
    if (selectedProd && cumulativeStats) {
      prodStatsStr = `\n【${selectedProd} 各等级达人人均出单】\n` +
        GRADE_ORDER.filter(g => cumulativeStats[g].count > 0).map(g =>
          `${g}级：${cumulativeStats[g].count}人，总出单${cumulativeStats[g].totalOrders}件，人均${cumulativeStats[g].avgOrders}件`
        ).join("\n");
    }

    const prompt = `你是TikTok美区女装BD的月度复盘助手。根据以下数据生成简洁的月度总结报告。

【达人数据】总达人${influencers.length}人，${gradeStr}
【产品数据】共${products.length}个产品，主推：${topProds}
${prodStatsStr}

请输出：
1. 核心亮点（1-2句）
2. 需关注的风险点（1-2句）
3. 下月重点动作建议（2-3条）
总字数200字以内，简洁直接。`;
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      setAiReport(data.content?.map(c => c.text || "").join("") || "");
    } catch { setAiReport("生成失败，请重试"); }
    setGenerating(false);
  }

  // ── 等级统计表格组件 ──────────────────────────────────────────────────────
  function GradeTable({ stats, title, expandable }) {
    const [expandedGrade, setExpandedGrade] = useState(null);
    const hasData = GRADE_ORDER.some(g => stats[g].count > 0);
    if (!hasData) return <div style={{ fontSize: 13, color: T.hint, padding: "16px 0" }}>本范围内暂无合作达人数据</div>;

    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#FDEEF4" }}>
                {["等级", "合作达人数", "累计出单总量", "人均出单", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 14px", textAlign: i === 0 ? "left" : "center", color: T.muted, fontWeight: 700, fontSize: 12, borderBottom: `1.5px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRADE_ORDER.filter(g => stats[g].count > 0).map(g => {
                const s = stats[g];
                const color = GRADE_COLORS[g] || T.muted;
                const isExp = expandedGrade === g;
                return (
                  <>
                    <tr key={g} style={{ borderBottom: `1px solid ${T.border}`, background: isExp ? `${color}08` : "white" }}>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, padding: "3px 10px", borderRadius: 8, background: `${color}18`, color }}>{g}</span>
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 600, color: T.text }}>{s.count} 人</td>
                      <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 700, color: T.text, fontSize: 16 }}>{s.totalOrders} 件</td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: parseFloat(s.avgOrders) >= 3 ? color : T.muted }}>
                          {s.avgOrders ?? "—"}
                        </span>
                        <span style={{ fontSize: 11, color: T.hint, marginLeft: 3 }}>件/人</span>
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        {expandable && s.infs.length > 0 && (
                          <button onClick={() => setExpandedGrade(isExp ? null : g)} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, cursor: "pointer", fontFamily: "inherit" }}>
                            {isExp ? "收起" : "查看明细"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${g}-detail`} style={{ background: `${color}05` }}>
                        <td colSpan={5} style={{ padding: "8px 14px 12px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {s.infs.sort((a, b) => b.orders - a.orders).map((inf, i) => (
                              <div key={i} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "#FFFFFF", border: `1px solid ${T.border}`, color: T.text }}>
                                <span style={{ color: T.muted }}>{inf.id}</span>
                                <span style={{ color: parseFloat(inf.orders) > 0 ? color : T.hint, fontWeight: 600, marginLeft: 6 }}>{inf.orders} 件</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            {/* 合计行 */}
            <tfoot>
              <tr style={{ background: "#FDEEF4", borderTop: `1.5px solid ${T.border}` }}>
                <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, color: T.text }}>合计</td>
                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: T.text }}>
                  {GRADE_ORDER.reduce((a, g) => a + stats[g].count, 0)} 人
                </td>
                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: T.accent, fontSize: 16 }}>
                  {GRADE_ORDER.reduce((a, g) => a + stats[g].totalOrders, 0)} 件
                </td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  {(() => {
                    const total = GRADE_ORDER.reduce((a, g) => a + stats[g].count, 0);
                    const orders = GRADE_ORDER.reduce((a, g) => a + stats[g].totalOrders, 0);
                    return total > 0 ? <><span style={{ fontSize: 18, fontWeight: 800, color: T.accent }}>{(orders/total).toFixed(1)}</span><span style={{ fontSize: 11, color: T.hint, marginLeft: 3 }}>件/人</span></> : "—";
                  })()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Tab 切换 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["product", "产品达人分析"], ["summary", "总览 & AI报告"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${view === k ? T.accent : T.border}`, background: view === k ? `${T.accent}15` : "transparent", color: view === k ? T.accent : T.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: view === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>

      {/* ── 产品达人分析 ── */}
      {view === "product" && (
        <div>
          {/* 产品选择 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>选择产品</div>
              <Sel value={selectedProd} onChange={setSelectedProd} style={{ width: "100%" }}>
                <option value="">请选择产品…</option>
                {activeProds.length > 0
                  ? activeProds.map(p => <option key={p.id} value={p.internalName}>{p.internalName}</option>)
                  : products.map(p => <option key={p.id} value={p.internalName}>{p.internalName}</option>)}
              </Sel>
            </div>
            <div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>月度筛选（选填）</div>
              <Sel value={selectedMonth} onChange={setSelectedMonth} style={{ width: "100%" }}>
                <option value="">全部时间（累计）</option>
                {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </Sel>
            </div>
          </div>

          {selectedMonth && (
            <div style={{ fontSize: 12, color: T.hint, marginBottom: 16, padding: "6px 10px", background: "#FDEEF4", borderRadius: 6 }}>
              {(() => {
                const [y, m] = selectedMonth.split("-").map(Number);
                const py = m === 1 ? y-1 : y; const pm = m === 1 ? 12 : m-1;
                return `寄样统计周期：${py}年${pm}月15日 ～ ${y}年${m}月14日`;
              })()}
            </div>
          )}

          {!selectedProd ? (
            <Card style={{ textAlign: "center", color: T.hint, fontSize: 14, padding: "40px" }}>请先选择产品</Card>
          ) : (
            <div>
              {/* 月度数据（有选月份时显示） */}
              {selectedMonth && monthlyStats && (
                <div style={{ marginBottom: 24 }}>
                  <GradeTable stats={monthlyStats} title={`${selectedMonth} 月度 · 各等级达人人均出单`} expandable={true} />
                </div>
              )}

              {/* 累计数据 */}
              {cumulativeStats && (
                <GradeTable stats={cumulativeStats} title={`${selectedProd} · 累计 · 各等级达人人均出单`} expandable={true} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 总览 & AI报告 ── */}
      {view === "summary" && (
        <div>
          {/* 全局达人概览 */}
          <SectionLabel>达人总览</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 }}>
            {GRADE_ORDER.map(g => {
              const cnt = influencers.filter(i => i.grade === g).length;
              const col = GRADE_COLORS[g] || T.muted;
              return (
                <div key={g} style={{ background: "#FFFFFF", border: `1.5px solid ${col}44`, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: col, fontWeight: 700, marginBottom: 4 }}>{g}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: T.text }}>{cnt}</div>
                  <div style={{ fontSize: 11, color: T.hint, marginTop: 2 }}>人</div>
                </div>
              );
            })}
          </div>

          {/* 所有产品汇总表 */}
          <SectionLabel>所有产品累计汇总</SectionLabel>
          {products.length === 0 ? (
            <Card style={{ textAlign: "center", color: T.hint }}>暂无产品数据</Card>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#FDEEF4" }}>
                      {["产品", "总合作达人", "总出单件数", "整体人均", ...GRADE_ORDER.map(g => `${g}人均`)].map((h, i) => (
                        <th key={i} style={{ padding: "10px 12px", textAlign: i === 0 ? "left" : "center", color: T.muted, fontWeight: 700, fontSize: 12, borderBottom: `1.5px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(prod => {
                      const st = calcGradeStats(prod.internalName, null);
                      const totalCnt = GRADE_ORDER.reduce((a, g) => a + st[g].count, 0);
                      const totalOrd = GRADE_ORDER.reduce((a, g) => a + st[g].totalOrders, 0);
                      const overallAvg = totalCnt > 0 ? (totalOrd / totalCnt).toFixed(1) : "—";
                      if (totalCnt === 0) return null;
                      return (
                        <tr key={prod.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: T.text }}>{prod.internalName}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: T.text }}>{totalCnt}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: T.accent }}>{totalOrd}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: T.text }}>{overallAvg}</td>
                          {GRADE_ORDER.map(g => {
                            const col = GRADE_COLORS[g];
                            return (
                              <td key={g} style={{ padding: "10px 12px", textAlign: "center" }}>
                                {st[g].count > 0
                                  ? <span style={{ fontWeight: 700, color: parseFloat(st[g].avgOrders) >= 3 ? col : T.muted }}>{st[g].avgOrders}</span>
                                  : <span style={{ color: T.hint }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }).filter(Boolean)}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* AI报告 */}
          <Btn onClick={genReport} accent disabled={generating} style={{ width: "100%", marginBottom: 12 }}>
            {generating ? "生成中…" : "生成 AI 月度总结报告"}
          </Btn>
          {aiReport && (
            <Card style={{ borderColor: `${T.accent}44` }}>
              <div style={{ fontSize: 12, color: T.accent, marginBottom: 8, fontWeight: 700 }}>AI 月度报告</div>
              <div style={{ fontSize: 14, lineHeight: 1.9, color: T.text, whiteSpace: "pre-wrap" }}>{aiReport}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 5: VIDEO COLLECT
// 上传文件字段：达人ID | 合作产品 | 视频发布时间 | 该视频成交件数
// 匹配键：达人ID（精确）+ 合作产品（模糊，去空格小写）
// 每条 CRM 记录维护 videoRecords: [ { date, product, orders } ]
// 同一达人+同一产品+同一发布日期 → 视为同一条视频，更新件数
// 累计件数 = 同一达人+同一产品的所有视频 orders 之和
// ══════════════════════════════════════════════════════════════════════════════

