import { useState, useMemo } from "react";
import { T } from "../constants/tokens.js";
import { normalize, matchProduct, inPeriod, parseDate, getPeriodBounds } from "../lib/utils.js";
import { getGrade } from "../constants/scoring.js";
import { useAI } from "../hooks/useAI.js";
import { Inp, Sel, Btn, Card, MetricCard } from "../components/ui/index.jsx";

export default function TrackingModule({ snapshots, onSave, influencers, products }) {
  const [tab, setTab] = useState("upload");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [sku, setSku] = useState("");
  // 视频端手动填入字段
  const [newVideoCount, setNewVideoCount] = useState("");      // 本月新发布视频数
  const [newWithSales, setNewWithSales] = useState("");        // 其中有成交的视频数
  const [newVideoOrders, setNewVideoOrders] = useState("");    // 新视频带来的订单量
  const [exposure, setExposure] = useState("");
  const [clicks, setClicks] = useState("");
  const [cvr, setCvr] = useState("");
  const [organicPct, setOrganicPct] = useState("");
  const [totalOrders, setTotalOrders] = useState("");          // 全品不区分新老视频总成交
  const [topVideoUrl, setTopVideoUrl] = useState("");
  const [topVideoGmv, setTopVideoGmv] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  function getPeriodBounds(monthStr) {
    if (!monthStr) return { start: null, end: null, label: "" };
    const [y, m] = monthStr.split("-").map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    const start = `${py}-${String(pm).padStart(2,"0")}-15`;
    const end   = `${y}-${String(m).padStart(2,"0")}-15`;
    return { start, end, label: `${py}年${pm}月15日 ～ ${y}年${m}月14日` };
  }

  function parseDate(str) {
    if (!str) return null;
    const s = str.trim().replace(/\//g, "-");
    const parts = s.split("-");
    if (parts.length === 3 && parts[0].length === 2) parts[0] = "20" + parts[0];
    const normed = parts.map((p, i) => i === 0 ? p : p.padStart(2, "0")).join("-");
    const d = new Date(normed);
    return isNaN(d.getTime()) ? null : normed;
  }

  function inPeriod(dateStr, start, end) {
    const d = parseDate(dateStr);
    return d ? d >= start && d < end : false;
  }

  const { start: pStart, end: pEnd, label: periodLabel } = getPeriodBounds(month);

  // 可复用：计算某产品在某周期的寄样端数据
  function calcSamplingFor(prodSku, start, end) {
    if (!prodSku || !start) return null;
    const pm = (a, b) => normalize(a) === normalize(b) || normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
    const sampledInfs = influencers.filter(inf => pm(inf.product, prodSku) && inPeriod(inf.shipDate || inf.date, start, end));
    const samplesCount = sampledInfs.length;
    const publishedInfs = sampledInfs.filter(inf => (inf.videoRecords || []).some(v => pm(v.product, prodSku)));
    const withSalesInfs = publishedInfs.filter(inf => {
      const vids = (inf.videoRecords || []).filter(v => pm(v.product, prodSku));
      return vids.reduce((a, v) => a + (v.orders || 0), 0) > 0;
    });
    const totalSold = sampledInfs.reduce((sum, inf) => {
      const vids = (inf.videoRecords || []).filter(v => pm(v.product, prodSku));
      return sum + vids.reduce((a, v) => a + (v.orders || 0), 0);
    }, 0);
    const fulfillRate = samplesCount ? ((publishedInfs.length / samplesCount) * 100).toFixed(1) : null;
    const saleRate = publishedInfs.length ? ((withSalesInfs.length / publishedInfs.length) * 100).toFixed(1) : null;
    const sampleRatio = samplesCount ? (totalSold / samplesCount).toFixed(2) : null;
    return { samplesCount, publishedCount: publishedInfs.length, withSalesCount: withSalesInfs.length, totalSold, fulfillRate, saleRate, sampleRatio, sampledInfs };
  }

  const autoSampling = useMemo(() => calcSamplingFor(sku, pStart, pEnd), [sku, pStart, pEnd, influencers]);

  const ctr = exposure && clicks ? ((parseFloat(clicks) / parseFloat(exposure)) * 100).toFixed(2) : null;
  // 视频出单率 = 出单视频数 ÷ 新视频总数（自动计算）
  const videoSaleRate = newVideoCount && newWithSales
    ? ((parseFloat(newWithSales) / parseFloat(newVideoCount)) * 100).toFixed(1) : null;
  // 新视频贡献占比 = 新视频订单量 ÷ 全品总成交订单量（自动计算）
  const newVideoPct = newVideoOrders && totalOrders && parseFloat(totalOrders) > 0
    ? ((parseFloat(newVideoOrders) / parseFloat(totalOrders)) * 100).toFixed(1) : null;

  // 把已保存快照的视频端数据载入表单，供编辑后重新保存（同月同产品会覆盖）
  function loadSnapshot(s) {
    setMonth(s.month);
    setSku(s.sku);
    setNewVideoCount(s.video?.newVideoCount || "");
    setNewWithSales(s.video?.newWithSales || "");
    setNewVideoOrders(s.video?.newVideoOrders || "");
    setExposure(s.video?.exposure || "");
    setClicks(s.video?.clicks || "");
    setCvr(s.video?.cvr || "");
    setOrganicPct(s.video?.organicPct || "");
    setTotalOrders(s.video?.totalOrders || "");
    setTopVideoUrl(s.video?.topVideoUrl || "");
    setTopVideoGmv(s.video?.topVideoGmv || "");
    setAnalysis(s.analysis || "");
    setTab("upload");
  }

  function saveSnapshot() {
    if (!sku || !month || !autoSampling) return;
    const snap = {
      id: Date.now(), month, sku,
      sampling: { samplesOut: String(autoSampling.samplesCount), fulfilled: String(autoSampling.publishedCount), withSales: String(autoSampling.withSalesCount), totalSold: String(autoSampling.totalSold), fulfillRate: autoSampling.fulfillRate, saleRate: autoSampling.saleRate, sampleSalesRatio: autoSampling.sampleRatio },
      video: { newVideoCount, newWithSales, videoSaleRate, newVideoOrders, exposure, clicks, ctr, cvr, organicPct, totalOrders, newVideoPct, topVideoUrl, topVideoGmv },
      analysis,
    };
    onSave([snap, ...snapshots.filter(s => !(s.month === month && s.sku === sku))]);
  }

  async function runAnalysis() {
    if (!autoSampling || !sku) return;
    setAnalyzing(true);
    const prevSnap = snapshots.find(s => s.sku === sku && s.month < month);
    const prompt = `你是TikTok美区女装BD数据分析助手。分析以下产品月度数据，给出简洁的趋势判断和优化建议。

产品: ${sku}  统计月份: ${month}  寄样周期: ${periodLabel}

【寄样端（自动统计）】
本期寄样量: ${autoSampling.samplesCount}件 | 履约率: ${autoSampling.fulfillRate}% | 出单率: ${autoSampling.saleRate}%
本期达人带来总成交: ${autoSampling.totalSold}件 | 样销比: 1:${autoSampling.sampleRatio}

【视频端（Shop后台）】
CTR: ${ctr||"—"}% | CVR: ${cvr||"—"}% | 自然流占比: ${organicPct||"—"}%
全品总成交: ${totalOrders||"—"}件 | 新视频贡献: ${newVideoPct||"—"}%

${prevSnap ? `【上月对比】样销比: 1:${prevSnap.sampling?.sampleSalesRatio||"—"} | CTR: ${prevSnap.video?.ctr||"—"}% | CVR: ${prevSnap.video?.cvr||"—"}%` : ""}

注意：寄样端与视频端存在10-20天履约周期错位。

请输出：
1. 本周期寄样工作质量评价（履约率/出单率是否达标）
2. 核心问题诊断（1-2句）
3. 下月优化建议（2-3条）
4. 产品推广决策（继续主推/维持/减少投入）
总字数150字以内，简洁直接。`;
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      setAnalysis(data.content?.map(c => c.text || "").join("") || "");
    } catch { setAnalysis("分析失败，请重试"); }
    setAnalyzing(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["upload", "本月数据"], ["compare", "本月多产品对比"], ["history", `历史快照 (${snapshots.length})`], ["trends", "产品长期追踪"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${tab === k ? T.accent : T.border}`, background: tab === k ? `${T.accent}15` : "transparent", color: tab === k ? T.accent : T.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: tab === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>

      {tab === "upload" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>统计月份</div>
              <Inp value={month} onChange={setMonth} placeholder="2026-05" />
            </div>
            <div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>产品</div>
              <Sel value={sku} onChange={setSku} style={{ width: "100%" }}>
                <option value="">选择产品…</option>
                {products.map(p => <option key={p.id} value={p.internalName}>{p.internalName}</option>)}
              </Sel>
            </div>
          </div>
          {periodLabel && (
            <div style={{ fontSize: 12, color: T.hint, marginBottom: 18, padding: "7px 12px", background: "#FDEEF4", borderRadius: 6 }}>
              📅 寄样统计周期：{periodLabel}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>寄样端</div>
            <span style={{ fontSize: 12, color: T.success, fontWeight: 600 }}>✓ 自动从 CRM + 视频回收计算</span>
          </div>

          {!sku ? (
            <Card style={{ textAlign: "center", color: T.hint, fontSize: 14 }}>请先选择产品</Card>
          ) : !autoSampling || autoSampling.samplesCount === 0 ? (
            <Card style={{ textAlign: "center", color: T.hint, fontSize: 14 }}>
              本周期内 CRM 中无该产品的寄样记录<br />
              <span style={{ fontSize: 12 }}>（{periodLabel}）</span>
            </Card>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
                <MetricCard label="本期寄样量" value={`${autoSampling.samplesCount} 件`} sub="CRM记录数" />
                <MetricCard label="已发布视频达人" value={`${autoSampling.publishedCount} 人`} sub={`履约率 ${autoSampling.fulfillRate}%`} />
                <MetricCard label="有成交达人" value={`${autoSampling.withSalesCount} 人`} sub={`出单率 ${autoSampling.saleRate}%`} />
                <MetricCard label="样销比" value={autoSampling.sampleRatio ? `1:${autoSampling.sampleRatio}` : "—"} sub={`${autoSampling.totalSold}件÷${autoSampling.samplesCount}件`} />
              </div>
              <Card style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10 }}>本期寄样达人明细（{autoSampling.samplesCount} 位）</div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {autoSampling.sampledInfs.map((inf, i) => {
                    const vids = (inf.videoRecords || []).filter(v => normalize(v.product) === normalize(sku) || normalize(v.product).includes(normalize(sku)) || normalize(sku).includes(normalize(v.product)));
                    const infOrders = vids.reduce((a, v) => a + (v.orders || 0), 0);
                    const g = getGrade(inf.score || 0);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, minWidth: 110 }}>{inf.influencerId}</span>
                        <span style={{ fontSize: 12, padding: "1px 7px", borderRadius: 20, background: `${g.color}18`, color: g.color, fontWeight: 700 }}>{inf.grade}</span>
                        <span style={{ fontSize: 12, color: T.hint }}>寄样 {inf.shipDate || inf.date}</span>
                        <span style={{ marginLeft: "auto", fontSize: 13 }}>
                          {vids.length > 0
                            ? <span style={{ color: infOrders > 0 ? T.success : T.muted, fontWeight: infOrders > 0 ? 600 : 400 }}>{infOrders > 0 ? `✓ 出单 ${infOrders} 件` : "已发布 · 0 件"}</span>
                            : <span style={{ color: T.danger }}>未发布</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>视频端</div>
            <span style={{ fontSize: 12, color: T.warning, fontWeight: 600 }}>从 TikTok Shop 后台手动填入</span>
          </div>
          <div style={{ fontSize: 12, color: T.warning, background: `${T.warning}10`, border: `1px solid ${T.warning}33`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, lineHeight: 1.6 }}>
            ⚠ 注意时间错位：视频端数据存在 10–20 天履约周期，本月看到的视频表现，主要来自<strong>上个月寄出</strong>的样品，不要和上方寄样端数据当作同一批货来归因。
          </div>

          {/* 视频数量组 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 10 }}>
            <div><div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 500 }}>本月新发布视频数</div><Inp value={newVideoCount} onChange={setNewVideoCount} placeholder="0" /></div>
            <div><div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 500 }}>其中有成交视频数</div><Inp value={newWithSales} onChange={setNewWithSales} placeholder="0" /></div>
          </div>

          {/* 视频出单率（自动计算） */}
          <div style={{ marginBottom: 14 }}>
            <MetricCard
              label="视频出单率（自动计算）"
              value={videoSaleRate ? `${videoSaleRate}%` : "—"}
              sub="有成交视频数 ÷ 新发布视频数"
            />
          </div>

          {/* 订单量组 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 10 }}>
            <div><div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 500 }}>新视频订单量</div><Inp value={newVideoOrders} onChange={setNewVideoOrders} placeholder="0" /></div>
            <div><div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 500 }}>全品总成交订单量（含老视频）</div><Inp value={totalOrders} onChange={setTotalOrders} placeholder="0" /></div>
          </div>

          {/* 新视频贡献占比（自动计算） */}
          <div style={{ marginBottom: 14 }}>
            <MetricCard
              label="新视频贡献占比（自动计算）"
              value={newVideoPct ? `${newVideoPct}%` : "—"}
              sub="新视频订单量 ÷ 全品总成交订单量"
            />
          </div>

          {/* 流量质量组 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 10 }}>
            {[["总曝光量", exposure, setExposure], ["点击次数", clicks, setClicks], ["转化率 CVR (%)", cvr, setCvr], ["自然流成交占比 (%)", organicPct, setOrganicPct]].map(([l, v, s]) => (
              <div key={l}><div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 500 }}>{l}</div><Inp value={v} onChange={s} placeholder="0" /></div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 10 }}>
            <MetricCard label="CTR" value={ctr ? `${ctr}%` : "—"} sub="点击÷曝光" />
            <MetricCard label="CVR" value={cvr ? `${cvr}%` : "—"} />
            <MetricCard label="自然流" value={organicPct ? `${organicPct}%` : "—"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div><div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 500 }}>本月最佳视频链接</div><Inp value={topVideoUrl} onChange={setTopVideoUrl} placeholder="https://tiktok.com/…" /></div>
            <div><div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 500 }}>最佳视频成交件数</div><Inp value={topVideoGmv} onChange={setTopVideoGmv} placeholder="0" /></div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn onClick={runAnalysis} accent disabled={analyzing || !sku || !autoSampling} style={{ flex: 1 }}>{analyzing ? "AI 分析中…" : "生成 AI 月度分析"}</Btn>
            <Btn onClick={saveSnapshot} disabled={!sku || !month || !autoSampling}>保存快照</Btn>
          </div>

          {analysis && (
            <Card style={{ borderColor: `${T.info}44` }}>
              <div style={{ fontSize: 12, color: T.info, marginBottom: 8, fontWeight: 700 }}>AI 月度分析</div>
              <div style={{ fontSize: 14, lineHeight: 1.9, color: T.text, whiteSpace: "pre-wrap" }}>{analysis}</div>
            </Card>
          )}
        </div>
      )}

      {tab === "compare" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>统计月份</div>
            <Inp value={month} onChange={setMonth} placeholder="2026-05" />
          </div>
          {periodLabel && (
            <div style={{ fontSize: 12, color: T.hint, marginBottom: 16, padding: "7px 12px", background: "#FDEEF4", borderRadius: 6 }}>
              📅 寄样统计周期：{periodLabel} · 所有产品横向对比
            </div>
          )}
          {(() => {
            const rows = products.map(p => ({ name: p.internalName, s: calcSamplingFor(p.internalName, pStart, pEnd) }))
              .filter(r => r.s && r.s.samplesCount > 0)
              .sort((a, b) => (parseFloat(b.s.sampleRatio) || 0) - (parseFloat(a.s.sampleRatio) || 0));
            if (!rows.length) return <Card style={{ textAlign: "center", color: T.hint, fontSize: 14 }}>本周期内无任何产品的寄样记录</Card>;
            return (
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#FDEEF4" }}>
                        {["产品", "寄样量", "发布达人", "出单达人", "履约率", "出单率", "样销比", "总成交"].map((h, i) => (
                          <th key={i} style={{ padding: "11px 12px", textAlign: i === 0 ? "left" : "center", color: T.muted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", borderBottom: `1.5px solid ${T.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 ? "#FEF8FB" : "#fff" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: T.text }}>{r.name}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: T.text }}>{r.s.samplesCount}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: T.text }}>{r.s.publishedCount}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: T.text }}>{r.s.withSalesCount}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: T.text }}>{r.s.fulfillRate ? `${r.s.fulfillRate}%` : "—"}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", color: T.text }}>{r.s.saleRate ? `${r.s.saleRate}%` : "—"}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: T.accent }}>{r.s.sampleRatio ? `1:${r.s.sampleRatio}` : "—"}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: T.text }}>{r.s.totalSold}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })()}
          <div style={{ fontSize: 12, color: T.hint, marginTop: 10 }}>按样销比从高到低排序，一眼看出本月哪个产品的达人转化效率最高。</div>
        </div>
      )}

      {tab === "history" && (
        <div>
          {snapshots.length === 0 ? <div style={{ textAlign: "center", color: T.muted, padding: "60px 0" }}>暂无快照</div> :
            snapshots.map(s => (
              <Card key={s.id}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{s.sku}</span>
                  <Badge label={s.month} color={T.info} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6 }}>寄样端</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <MetricCard label="寄样量" value={s.sampling?.samplesOut || "—"} />
                      <MetricCard label="履约率" value={s.sampling?.fulfillRate ? `${s.sampling.fulfillRate}%` : "—"} />
                      <MetricCard label="出单率" value={s.sampling?.saleRate ? `${s.sampling.saleRate}%` : "—"} />
                      <MetricCard label="样销比" value={s.sampling?.sampleSalesRatio ? `1:${s.sampling.sampleSalesRatio}` : "—"} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6 }}>视频端</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <MetricCard label="新视频数" value={s.video?.newVideoCount || "—"} />
                      <MetricCard label="视频出单率" value={s.video?.videoSaleRate ? `${s.video.videoSaleRate}%` : "—"} />
                      <MetricCard label="CTR" value={s.video?.ctr ? `${s.video.ctr}%` : "—"} />
                      <MetricCard label="CVR" value={s.video?.cvr ? `${s.video.cvr}%` : "—"} />
                      <MetricCard label="总成交" value={s.video?.totalOrders || "—"} />
                      <MetricCard label="新视频贡献" value={s.video?.newVideoPct ? `${s.video.newVideoPct}%` : "—"} />
                    </div>
                  </div>
                </div>
                {s.analysis && <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, borderTop: `1px solid ${T.border}`, paddingTop: 10, marginBottom: 10 }}>{s.analysis.slice(0, 150)}…</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn small onClick={() => loadSnapshot(s)}>编辑（载入表单）</Btn>
                  <Btn small danger onClick={() => onSave(snapshots.filter(x => x.id !== s.id))}>删除此快照</Btn>
                </div>
              </Card>
            ))}
        </div>
      )}

      {tab === "trends" && <TrendsPanel snapshots={snapshots} products={products} />}
    </div>
  );
}

// ── 产品长期追踪看板 ──────────────────────────────────────────────────────────
function TrendsPanel({ snapshots, products }) {
  const [selectedSku, setSelectedSku] = useState("");

  // 获取有快照的产品列表
  const skusWithData = [...new Set(snapshots.map(s => s.sku))].sort();

  // 该产品所有快照，按月份升序
  const prodSnaps = useMemo(() =>
    snapshots.filter(s => s.sku === selectedSku).sort((a, b) => a.month.localeCompare(b.month)),
    [snapshots, selectedSku]
  );

  // 累计汇总
  const totals = useMemo(() => {
    if (!prodSnaps.length) return null;
    const totalSamples  = prodSnaps.reduce((a, s) => a + (parseFloat(s.sampling?.samplesOut) || 0), 0);
    const totalVideos   = prodSnaps.reduce((a, s) => a + (parseFloat(s.sampling?.fulfilled) || 0), 0);
    const totalSold     = prodSnaps.reduce((a, s) => a + (parseFloat(s.sampling?.totalSold) || 0), 0);
    const totalWithSales = prodSnaps.reduce((a, s) => a + (parseFloat(s.sampling?.withSales) || 0), 0);
    // 达人出单率 = 累计有成交达人 ÷ 累计出视频达人
    const cumSaleRate   = totalVideos ? ((totalWithSales / totalVideos) * 100).toFixed(1) : null;
    // 样销比 = 达人总销量 ÷ 总寄样量
    const cumSampleRatio = totalSamples ? (totalSold / totalSamples).toFixed(2) : null;
    return { totalSamples, totalVideos, totalSold, totalWithSales, cumSaleRate, cumSampleRatio };
  }, [prodSnaps]);

  // 趋势方向判断
  function trend(arr) {
    if (arr.length < 2) return null;
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    if (last == null || prev == null) return null;
    if (parseFloat(last) > parseFloat(prev)) return { dir: "↑", color: T.success };
    if (parseFloat(last) < parseFloat(prev)) return { dir: "↓", color: T.danger };
    return { dir: "→", color: T.muted };
  }

  if (!skusWithData.length) {
    return <Card style={{ textAlign: "center", color: T.muted, fontSize: 14, padding: "40px" }}>还没有保存过快照，先在「本月数据」保存至少一个月的数据。</Card>;
  }

  return (
    <div>
      {/* 产品选择 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 6, fontWeight: 600 }}>选择产品</div>
        <Sel value={selectedSku} onChange={setSelectedSku} style={{ width: "100%" }}>
          <option value="">请选择…</option>
          {skusWithData.map(s => <option key={s} value={s}>{s}</option>)}
        </Sel>
      </div>

      {!selectedSku && <Card style={{ textAlign: "center", color: T.hint, fontSize: 14 }}>选择产品后显示长期追踪数据</Card>}

      {selectedSku && prodSnaps.length > 0 && (
        <div>
          {/* 累计汇总 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
            累计汇总（共 {prodSnaps.length} 个月）
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "#FFFFFF", border: `1.5px solid ${T.accent}44`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 6 }}>总寄样量</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.accent }}>{totals?.totalSamples ?? "—"}</div>
              <div style={{ fontSize: 11, color: T.hint, marginTop: 3 }}>件</div>
            </div>
            <div style={{ background: "#FFFFFF", border: `1.5px solid ${T.info}44`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 6 }}>总发布视频达人</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.info }}>{totals?.totalVideos ?? "—"}</div>
              <div style={{ fontSize: 11, color: T.hint, marginTop: 3 }}>人次</div>
            </div>
            <div style={{ background: "#FFFFFF", border: `1.5px solid ${T.success}44`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 6 }}>达人出单率</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.success }}>{totals?.cumSaleRate ? `${totals.cumSaleRate}%` : "—"}</div>
              <div style={{ fontSize: 11, color: T.hint, marginTop: 3 }}>有成交达人÷出视频达人</div>
            </div>
            <div style={{ background: "#FFFFFF", border: `1.5px solid ${T.a}44`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 6 }}>累计样销比</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.a }}>1:{totals?.cumSampleRatio ?? "—"}</div>
              <div style={{ fontSize: 11, color: T.hint, marginTop: 3 }}>总销量{totals?.totalSold}件÷总寄样{totals?.totalSamples}件</div>
            </div>
          </div>

          {/* 月度趋势表格 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
            月度指标趋势
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#FDEEF4" }}>
                    {["月份", "寄样量", "发布达人", "出单达人", "出单率", "样销比", "总成交", "CTR", "CVR", "自然流"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: h === "月份" ? "left" : "center", color: T.muted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", borderBottom: `1.5px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prodSnaps.map((s, i) => {
                    const saleRateArr = prodSnaps.slice(0, i + 1).map(x => x.sampling?.saleRate);
                    const ratioArr = prodSnaps.slice(0, i + 1).map(x => x.sampling?.sampleSalesRatio);
                    const ctrArr = prodSnaps.slice(0, i + 1).map(x => x.video?.ctr);
                    const saleT = trend(saleRateArr);
                    const ratioT = trend(ratioArr);
                    const ctrT = trend(ctrArr);
                    return (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? "#FFFFFF" : "#FEF8FB" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 700, color: T.text, whiteSpace: "nowrap" }}>{s.month}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: T.text }}>{s.sampling?.samplesOut || "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: T.text }}>{s.sampling?.fulfilled || "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: T.text }}>{s.sampling?.withSales || "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ color: T.text }}>{s.sampling?.saleRate ? `${s.sampling.saleRate}%` : "—"}</span>
                          {saleT && <span style={{ color: saleT.color, marginLeft: 4, fontSize: 11 }}>{saleT.dir}</span>}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ color: T.text }}>{s.sampling?.sampleSalesRatio ? `1:${s.sampling.sampleSalesRatio}` : "—"}</span>
                          {ratioT && <span style={{ color: ratioT.color, marginLeft: 4, fontSize: 11 }}>{ratioT.dir}</span>}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 600, color: T.text }}>{s.sampling?.totalSold || s.video?.totalOrders || "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ color: T.text }}>{s.video?.ctr ? `${s.video.ctr}%` : "—"}</span>
                          {ctrT && <span style={{ color: ctrT.color, marginLeft: 4, fontSize: 11 }}>{ctrT.dir}</span>}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: T.text }}>{s.video?.cvr ? `${s.video.cvr}%` : "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: T.text }}>{s.video?.organicPct ? `${s.video.organicPct}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 趋势说明 */}
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: T.hint }}>
            <span><span style={{ color: T.success }}>↑</span> 相比上月上升</span>
            <span><span style={{ color: T.danger }}>↓</span> 相比上月下降</span>
            <span><span style={{ color: T.muted }}>→</span> 持平</span>
          </div>
        </div>
      )}
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════════════════
// MODULE 4: CRM
// ══════════════════════════════════════════════════════════════════════════════
const CRM_STATUSES = ["待接触", "已寄样", "已发布", "待复投", "复投完成", "不合作"];
const STATUS_COLORS = { "待接触": "#8A90A0", "已寄样": "#D97706", "已发布": "#0D9E6A", "待复投": "#0369A1", "复投完成": "#7C3AED", "不合作": "#DC2626" };

function exportCSV(influencers) {
  const headers = [
    "达人ID", "跟进人", "寄样产品", "联系方式", "评分", "等级",
    "销售数据得分", "垂直程度得分", "内容表现得分", "匹配度得分",
    "合作状态", "发布视频个数", "累计成交件数", "寄样日期", "录入日期", "备注"
  ];
  const rows = influencers.map(inf => {
    const vids = (inf.videoRecords || []).filter(v =>
      !inf.product || normalize(v.product) === normalize(inf.product) ||
      normalize(v.product).includes(normalize(inf.product)) ||
      normalize(inf.product).includes(normalize(v.product))
    );
    const videoCount = vids.length;
    const totalOrders = vids.reduce((a, v) => a + (v.orders || 0), 0);
    return [
      inf.influencerId || "",
      inf.bd || "",
      inf.product || "",
      inf.contact || "",
      inf.score ?? "",
      inf.grade || "",
      inf.dimScores?.sales ? `${inf.dimScores.sales.raw}/${inf.dimScores.sales.max}` : "",
      inf.dimScores?.vertical ? `${inf.dimScores.vertical.raw}/${inf.dimScores.vertical.max}` : "",
      inf.dimScores?.content ? `${inf.dimScores.content.raw}/${inf.dimScores.content.max}` : "",
      inf.dimScores?.match ? `${inf.dimScores.match.raw}/${inf.dimScores.match.max}` : "",
      inf.crmStatus || "",
      videoCount,
      totalOrders,
      inf.shipDate || inf.date || "",
      inf.date || "",
      (inf.note || "").replace(/,/g, "，"),
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `CRM_达人记录_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
  a.click(); URL.revokeObjectURL(url);
}


