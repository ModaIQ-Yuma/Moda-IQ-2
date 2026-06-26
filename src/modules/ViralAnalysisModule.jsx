import { useState } from "react";
import { T } from "../constants/tokens.js";
import { normalize, parseCSVLine } from "../lib/utils.js";
import { SK, AI_MAX_TOKENS_VIRAL } from "../constants/config.js";
import { getGrade } from "../constants/scoring.js";
import { useAI } from "../hooks/useAI.js";
import { Btn, Card, Badge, SectionLabel } from "../components/ui/index.jsx";

export default function ViralAnalysisModule({ influencers, products, onSaveProducts }) {
  const [enriched, setEnriched] = useState([]);
  const [results, setResults] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem("tkbd_viral_v1")) || []; } catch { return []; } });
  const [expandedResult, setExpandedResult] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  // 记录每条结果已追加的字段，key 格式 `${resultIndex}-${field}`
  const [appliedFields, setAppliedFields] = useState({});

  function saveHistory(items) { setHistory(items); localStorage.setItem("tkbd_viral_v1", JSON.stringify(items)); }

  function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const sep = lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(sep).map(h => h.replace(/"/g, "").trim());
      const idx = kws => headers.findIndex(h => kws.some(k => h.toLowerCase().includes(k.toLowerCase())));
      const iProduct  = idx(["产品","product","sku"]);
      const iCreator  = idx(["达人","creator","influencer"]);
      const iDuration = idx(["时长","duration"]);
      const iDate     = idx(["发布","date","时间"]);
      const iSubtitle = idx(["字幕","subtitle","文案","script","caption"]);
      const iSales    = idx(["销量","sales","件数","成交","orders"]);
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = sep === "\t" ? lines[i].split("\t").map(c => c.replace(/"/g,"").trim()) : parseCSVLine(lines[i]);
        if (cols.length < 2) continue;
        const r = {
          product:   iProduct >= 0  ? cols[iProduct]  : "",
          creatorId: iCreator >= 0  ? cols[iCreator]  : "",
          duration:  iDuration >= 0 ? cols[iDuration] : "",
          date:      iDate >= 0     ? cols[iDate]     : "",
          subtitle:  iSubtitle >= 0 ? cols[iSubtitle] : "",
          sales:     iSales >= 0    ? parseInt(cols[iSales]) || 0 : 0,
        };
        const inf  = influencers.find(i => normalize(i.influencerId) === normalize(r.creatorId));
        const prod = products.find(p => normalize(p.internalName) === normalize(r.product) || normalize(p.productTitle||"") === normalize(r.product));
        parsed.push({ ...r, crmGrade: inf?.grade||null, crmScore: inf?.score||null, crmStatus: inf?.crmStatus||null, productTitle: prod?.productTitle||"", knownPoints: prod?.keyPoints||"" });
      }
      setEnriched(parsed); setResults([]);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function runAnalysis() {
    if (!enriched.length) return;
    setAnalyzing(true); setProgress(0); setResults([]);
    const out = [];
    for (let i = 0; i < enriched.length; i++) {
      setProgress(Math.round((i / enriched.length) * 100));
      const r = enriched[i];
      if (!r.subtitle.trim()) { out.push({ ...r, analysis: null, skipped: true }); continue; }
      const gradeCtx = r.crmGrade ? `该达人已在CRM中，等级【${r.crmGrade}】评分${r.crmScore}分，状态：${r.crmStatus}。` : `该达人不在CRM中，无历史数据。`;
      const prompt = `你是TikTok美区女装爆款分析专家。分析以下视频：

产品：${r.product}（商品名：${r.productTitle||"未知"}）
已知卖点：${r.knownPoints||"未录入"}
达人：${r.creatorId||"未知"}，${gradeCtx}
时长：${r.duration||"未知"}，发布：${r.date||"未知"}，周期成交：${r.sales}件

字幕内容：
${r.subtitle}

请按以下结构输出，每个标题严格保持格式不变：

**【1. 产品痛点】**
消费者真实痛点，1–3条，每条一行。

**【2. 产品卖点】**
视频实际传递的最有转化力的卖点，1–3条，每条一行。

**【3. 爆单归因】**
判断：【达人主导】/【内容主导】/【双重驱动】
达人因素：粉丝量级、等级${r.crmGrade||"未知"}、垂直度、信任度
内容因素：字幕质量、场景感、卖点清晰度、情绪感染力、时长匹配
给出明确判断和核心理由2–3句。

**【4. 可复用内容策略】**
其他达人要复制成功，最关键的1–2个内容要素。

**【5. 建议更新的产品卖点】**
直接给出可填入产品档案的卖点文字，用顿号或逗号分隔，不要分条。

**【6. 推荐达人画像】**
基于这条视频的成功，分析最适合推广此产品的达人特征。
- 身材类型（从以下选择最匹配的，可多选）：petite / curvy / plus-size / midsize / athletic / hourglass / postpartum body / tall girl
- 达人人设（如有必要，从以下选择）：mom creator / working mom / gym girl / corporate girl / Latina creator / fashion reviewer
- 说明原因（1–2句）

**【7. 病毒性关键词】**
从字幕中提炼出最具传播力和转化力的关键词、短句或表达方式，用逗号分隔，直接列出，不要解释。例如：flattering on every body type, hides the tummy, so comfortable all day

中文回答（第7条关键词如视频为英文则保留英文），简洁有力。`;
      try {
        const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }) });
        const data = await res.json();
        out.push({ ...r, analysis: data.content?.map(c => c.text||"").join("")||"失败", skipped: false });
      } catch { out.push({ ...r, analysis: "网络错误", skipped: false }); }
    }
    setProgress(100); setResults(out); setAnalyzing(false);
    saveHistory([{ id: Date.now(), date: new Date().toLocaleDateString("zh-CN"), count: out.length, items: out }, ...history]);
  }

  // 提取三个需要写入产品档案的字段
  function extractField(text, sectionNum) {
    const pattern = new RegExp(`【${sectionNum}[^】]*】([\\s\\S]*?)(?=\\n\\*\\*【|$)`);
    const m = text?.match(pattern);
    return m ? m[1].replace(/\*\*/g, "").trim() : "";
  }

  // 单字段追加：field 为 "keyPoints" | "creatorProfile" | "viralKeywords"
  function applyField(r, field, content) {
    const prod = products.find(p => normalize(p.internalName) === normalize(r.product) || normalize(p.productTitle||"") === normalize(r.product));
    if (!prod) { alert(`产品「${r.product}」未在产品管理中找到，请先在产品管理中添加该产品。`); return false; }
    const joiner = field === "creatorProfile" ? "\n---\n" : field === "viralKeywords" ? "，" : "；";
    onSaveProducts(products.map(p => p.id === prod.id ? {
      ...p,
      [field]: [p[field], content].filter(Boolean).join(joiner),
    } : p));
    return true;
  }

  function extractSuggested(text) {
    const kp = extractField(text, "5");
    const cp = extractField(text, "6");
    const vk = extractField(text, "7");
    return { kp, cp, vk, hasAny: !!(kp || cp || vk) };
  }

  const attrLabel = text => {
    if (!text) return null;
    if (text.includes("达人主导")) return "达人主导";
    if (text.includes("内容主导")) return "内容主导";
    if (text.includes("双重")) return "双重驱动";
    return null;
  };
  const attrColor = text => {
    const l = typeof text === "string" ? text : attrLabel(text);
    if (!l) return T.muted;
    if (l.includes("达人")) return "#7C3AED";
    if (l.includes("内容")) return "#0D9E6A";
    if (l.includes("双重")) return "#D97706";
    return T.muted;
  };

  return (
    <div>
      <Card style={{ borderColor: `${T.accent}44` }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>爆款视频分析</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.8, marginBottom: 14 }}>
          上传含字幕的视频数据文件，AI 自动分析痛点、卖点、爆单归因，并可一键更新产品档案。<br />
          必须包含列：<span style={{ color: T.accent, fontWeight: 600 }}>产品 / 达人ID / 视频时长 / 发布时间 / 字幕 / 周期销量</span>
        </div>
        <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{ fontSize: 13, color: T.muted, display: "block", marginBottom: 12 }} />

        {enriched.length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>
              识别 <strong style={{ color: T.accent }}>{enriched.length}</strong> 条 ·
              匹配CRM达人 <strong style={{ color: T.success }}>{enriched.filter(r => r.crmGrade).length}</strong> 条 ·
              匹配产品卖点 <strong style={{ color: T.info }}>{enriched.filter(r => r.knownPoints).length}</strong> 条
            </div>
            <div style={{ overflowX: "auto", marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["产品","达人","CRM等级","时长","日期","销量","字幕预览"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: T.muted, borderBottom: `1.5px solid ${T.border}`, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}</tr></thead>
                <tbody>{enriched.slice(0, 5).map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, color: T.text }}>{r.product}</td>
                    <td style={{ padding: "6px 10px", color: T.text }}>{r.creatorId}</td>
                    <td style={{ padding: "6px 10px" }}>
                      {r.crmGrade
                        ? <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: `${getGrade(r.crmScore||0).color}18`, color: getGrade(r.crmScore||0).color, fontWeight: 700 }}>{r.crmGrade}</span>
                        : <span style={{ fontSize: 12, color: T.hint }}>未入库</span>}
                    </td>
                    <td style={{ padding: "6px 10px", color: T.muted }}>{r.duration}</td>
                    <td style={{ padding: "6px 10px", color: T.muted, whiteSpace: "nowrap" }}>{r.date}</td>
                    <td style={{ padding: "6px 10px", fontWeight: 600 }}>{r.sales}</td>
                    <td style={{ padding: "6px 10px", color: T.hint, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitle.slice(0,40)}…</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {analyzing && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted, marginBottom: 5 }}><span>分析中…</span><span>{progress}%</span></div>
                <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: T.accent, borderRadius: 3, transition: "width 0.3s" }} />
                </div>
              </div>
            )}
            <Btn onClick={runAnalysis} accent disabled={analyzing} style={{ width: "100%" }}>
              {analyzing ? `分析中 ${progress}%…` : `开始 AI 分析（${enriched.length} 条）`}
            </Btn>
          </div>
        )}
      </Card>

      {results.length > 0 && (
        <div>
          <SectionLabel>分析结果（{results.filter(r => !r.skipped).length} 条）</SectionLabel>
          {/* 归因汇总 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
            {[["达人主导","#7C3AED"],["内容主导","#0D9E6A"],["双重驱动","#D97706"]].map(([label, color]) => (
              <div key={label} style={{ background: "#fff", border: `1.5px solid ${color}44`, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>{results.filter(r => attrLabel(r.analysis) === label).length}</div>
              </div>
            ))}
          </div>
          {results.map((r, i) => {
            const label = attrLabel(r.analysis);
            const color = attrColor(r.analysis);
            const { kp, cp, vk, hasAny } = extractSuggested(r.analysis);
            const isExp = expandedResult === i;
            return (
              <Card key={i} style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setExpandedResult(isExp ? null : i)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{r.product}</span>
                      {r.crmGrade && <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: `${getGrade(r.crmScore||0).color}18`, color: getGrade(r.crmScore||0).color, fontWeight: 700 }}>{r.crmGrade}级</span>}
                      {label && <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: `${color}15`, color, fontWeight: 700 }}>{label}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>{r.creatorId} · {r.date} · {r.duration} · <strong style={{ color: T.text }}>{r.sales} 件</strong></div>
                  </div>
                  <span style={{ fontSize: 13, color: T.hint }}>{isExp ? "▲" : "▼"}</span>
                </div>
                {isExp && !r.skipped && r.analysis && (
                  <div style={{ borderTop: `1.5px solid ${T.border}`, marginTop: 12, paddingTop: 14 }}>
                    {/* 字幕原文 */}
                    <div style={{ background: "#FEF6FA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
                      <strong style={{ color: T.text }}>字幕：</strong>{r.subtitle}
                    </div>
                    {/* AI全文分析 */}
                    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.9, whiteSpace: "pre-wrap", marginBottom: 16 }}>{r.analysis}</div>

                    {/* 提取的三个字段：分别确认追加 */}
                    {hasAny && (
                      <div style={{ background: "#F0F8F4", border: `1.5px solid ${T.success}44`, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.success, marginBottom: 4 }}>检测到「{r.product}」有新的分析结论</div>
                        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>请分别确认是否追加到产品档案：</div>

                        {kp && (() => {
                          const key = `${i}-keyPoints`;
                          const done = appliedFields[key];
                          return (
                            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 4 }}>卖点更新</div>
                              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, background: "#fff", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>{kp}</div>
                              {done ? (
                                <span style={{ fontSize: 13, color: T.success, fontWeight: 700 }}>✓ 已追加到卖点</span>
                              ) : (
                                <Btn small onClick={() => { if (applyField(r, "keyPoints", kp)) setAppliedFields(p => ({ ...p, [key]: true })); }} style={{ background: T.success, color: "#fff", border: "none", fontWeight: 700 }}>追加卖点</Btn>
                              )}
                            </div>
                          );
                        })()}

                        {cp && (() => {
                          const key = `${i}-creatorProfile`;
                          const done = appliedFields[key];
                          return (
                            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                              <div style={{ fontSize: 12, color: T.a, fontWeight: 600, marginBottom: 4 }}>推荐达人画像</div>
                              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, background: "#fff", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap", marginBottom: 8 }}>{cp}</div>
                              {done ? (
                                <span style={{ fontSize: 13, color: T.a, fontWeight: 700 }}>✓ 已追加到达人画像</span>
                              ) : (
                                <Btn small onClick={() => { if (applyField(r, "creatorProfile", cp)) setAppliedFields(p => ({ ...p, [key]: true })); }} style={{ background: T.a, color: "#fff", border: "none", fontWeight: 700 }}>追加达人画像</Btn>
                              )}
                            </div>
                          );
                        })()}

                        {vk && (() => {
                          const key = `${i}-viralKeywords`;
                          const done = appliedFields[key];
                          return (
                            <div>
                              <div style={{ fontSize: 12, color: T.success, fontWeight: 600, marginBottom: 6 }}>病毒性关键词</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                {vk.split(/[，,]/).filter(k => k.trim()).map((kw, ki) => (
                                  <span key={ki} style={{ fontSize: 13, padding: "3px 11px", borderRadius: 20, background: `${T.success}15`, color: T.success, fontWeight: 600, border: `1px solid ${T.success}44` }}>{kw.trim()}</span>
                                ))}
                              </div>
                              {done ? (
                                <span style={{ fontSize: 13, color: T.success, fontWeight: 700 }}>✓ 已追加到关键词</span>
                              ) : (
                                <Btn small onClick={() => { if (applyField(r, "viralKeywords", vk)) setAppliedFields(p => ({ ...p, [key]: true })); }} style={{ background: T.success, color: "#fff", border: "none", fontWeight: 700 }}>追加关键词</Btn>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
                {isExp && r.skipped && <div style={{ borderTop: `1.5px solid ${T.border}`, marginTop: 12, paddingTop: 12, fontSize: 13, color: T.hint }}>无字幕内容，已跳过。</div>}
              </Card>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <SectionLabel>历史分析记录（{history.length} 批次）</SectionLabel>
          {history.map(batch => {
            const isExp = expandedHistory === batch.id;
            return (
              <Card key={batch.id} style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setExpandedHistory(isExp ? null : batch.id)}>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{batch.date} · {batch.count} 条</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["达人主导","内容主导","双重驱动"].map(label => {
                      const cnt = batch.items?.filter(r => attrLabel(r.analysis) === label).length || 0;
                      if (!cnt) return null;
                      return <span key={label} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${attrColor(label)}15`, color: attrColor(label), fontWeight: 600 }}>{label} {cnt}</span>;
                    })}
                  </div>
                  <span style={{ fontSize: 13, color: T.hint }}>{isExp ? "▲" : "▼"}</span>
                </div>
                {isExp && (
                  <div style={{ borderTop: `1.5px solid ${T.border}`, marginTop: 12, paddingTop: 12 }}>
                    {batch.items?.map((r, i) => (
                      <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{r.product}</span>
                          {r.crmGrade && <span style={{ fontSize: 12, padding: "1px 7px", borderRadius: 20, background: `${getGrade(r.crmScore||0).color}18`, color: getGrade(r.crmScore||0).color, fontWeight: 700 }}>{r.crmGrade}</span>}
                          {attrLabel(r.analysis) && <span style={{ fontSize: 12, padding: "1px 7px", borderRadius: 20, background: `${attrColor(r.analysis)}15`, color: attrColor(r.analysis), fontWeight: 700 }}>{attrLabel(r.analysis)}</span>}
                          <span style={{ fontSize: 13, color: T.muted, marginLeft: "auto" }}>{r.sales}件 · {r.date}</span>
                        </div>
                        {r.analysis && <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginTop: 4 }}>{r.analysis.slice(0,120)}…</div>}
                      </div>
                    ))}
                    <div style={{ marginTop: 10 }}>
                      <Btn small danger onClick={() => saveHistory(history.filter(b => b.id !== batch.id))}>删除此批次</Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

