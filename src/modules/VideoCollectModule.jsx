import { useState, useMemo } from "react";
import { T } from "../constants/tokens.js";
import { normalize, matchProduct, parseCSVLine } from "../lib/utils.js";
import { REPOST_THRESHOLD_ORDERS, SK } from "../constants/config.js";
import { STATUS_COLORS } from "../constants/crm.js";
import { getGrade } from "../constants/scoring.js";
import { Btn, Card, Badge, SectionLabel } from "../components/ui/index.jsx";

export default function VideoCollectModule({ influencers, onSave }) {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [viewId, setViewId] = useState(null);
  // 未匹配视频（达人自购自拍）持久化存储
  const [unmatchedVideos, setUnmatchedVideos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tkbd_unmatched_videos_v1")) || []; } catch { return []; }
  });
  const [unmatchedExpanded, setUnmatchedExpanded] = useState(null);
  // 导入批次历史（用于撤销）
  const [importBatches, setImportBatches] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tkbd_import_batches_v1")) || []; } catch { return []; }
  });
  const [showBatches, setShowBatches] = useState(false);
  const [confirmUndoBatch, setConfirmUndoBatch] = useState(null);

  function saveBatches(batches) {
    setImportBatches(batches);
    localStorage.setItem("tkbd_import_batches_v1", JSON.stringify(batches));
  }

  function saveUnmatched(items) {
    setUnmatchedVideos(items);
    localStorage.setItem("tkbd_unmatched_videos_v1", JSON.stringify(items));
  }

  function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    // 先尝试 UTF-8，如果中文乱码再自动用 GBK 重读
    const tryRead = (encoding) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        // 检测乱码：UTF-8 读 GBK 文件时常见替换字符
        if (encoding === "UTF-8" && text.includes("�")) {
          tryRead("GBK");
          return;
        }
        setRawText(text); setPreview(parseRows(text)); setResult(null);
      };
      reader.readAsText(file, encoding);
    };
    tryRead("UTF-8");
  }

  function parseRows(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map(h => h.replace(/"/g, "").trim());
    const idx = (keywords) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
    const iId   = idx(["达人id","达人ID","influencer","tiktok"]);
    const iProd = idx(["合作产品","产品","product","sku"]);
    const iDate = idx(["发布时间","发布日期","date","时间"]);
    const iOrd  = idx(["成交件数","件数","销量","orders","成交"]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = sep === "\t" ? lines[i].split("\t").map(c => c.replace(/"/g,"").trim()) : parseCSVLine(lines[i]);
      if (cols.length < 2) continue;
      const row = {
        influencerId: iId >= 0 ? cols[iId] : "",
        product:      iProd >= 0 ? cols[iProd] : "",
        date:         iDate >= 0 ? cols[iDate] : "",
        orders:       iOrd >= 0 ? parseInt(cols[iOrd]) || 0 : 0,
      };
      if (row.influencerId) rows.push(row);
    }
    return rows;
  }

  // ── 匹配逻辑：同时检查 influencerId 和 aliases（曾用名）──────────────────
  function findInCRM(updated, row) {
    return updated.findIndex(inf => {
      // 主ID匹配
      const idMatch = normalize(inf.influencerId) === normalize(row.influencerId);
      // 曾用名匹配
      const aliasMatch = (inf.aliases || []).some(a => normalize(a) === normalize(row.influencerId));
      const prodMatch = !row.product ||
        normalize(inf.product) === normalize(row.product) ||
        normalize(inf.product).includes(normalize(row.product)) ||
        normalize(row.product).includes(normalize(inf.product));
      return (idMatch || aliasMatch) && prodMatch;
    });
  }

  function runImport() {
    if (!preview.length) return;
    const matched = [], newUnmatched = [], statusChanges = [];
    const updated = influencers.map(inf => ({ ...inf }));

    preview.forEach(row => {
      const idx = findInCRM(updated, row);
      if (idx === -1) { newUnmatched.push({ ...row, importDate: new Date().toLocaleDateString("zh-CN") }); return; }

      const inf = { ...updated[idx] };
      const statusBefore = inf.crmStatus || "待接触";
      if (!inf.videoRecords) inf.videoRecords = [];
      const vIdx = inf.videoRecords.findIndex(v =>
        normalize(v.product) === normalize(row.product) &&
        normalize(v.date) === normalize(row.date)
      );
      if (vIdx >= 0) {
        const prev = inf.videoRecords[vIdx].orders;
        inf.videoRecords = inf.videoRecords.map((v, i) => i === vIdx ? { ...v, orders: row.orders } : v);
        matched.push({ ...row, action: "更新", prevOrders: prev, newOrders: row.orders });
      } else {
        inf.videoRecords = [...inf.videoRecords, { product: row.product, date: row.date, orders: row.orders }];
        matched.push({ ...row, action: "新增" });
      }
      const prePublish = ["待接触", "已寄样"];
      if (prePublish.includes(inf.crmStatus || "待接触")) inf.crmStatus = "已发布";
      const relevantVids = inf.videoRecords.filter(v =>
        !inf.product || normalize(v.product) === normalize(inf.product) ||
        normalize(v.product).includes(normalize(inf.product)) ||
        normalize(inf.product).includes(normalize(v.product))
      );
      const cumOrders = relevantVids.reduce((a, v) => a + (v.orders || 0), 0);
      if (cumOrders >= 3 && inf.crmStatus !== "复投完成" && inf.crmStatus !== "不合作") inf.crmStatus = "待复投";
      // 记录状态变更（同一达人只记一次最终变化）
      if (inf.crmStatus !== statusBefore) {
        const existing = statusChanges.find(s => s.id === inf.id);
        if (existing) { existing.to = inf.crmStatus; }
        else statusChanges.push({ id: inf.id, influencerId: inf.influencerId, from: statusBefore, to: inf.crmStatus });
      }
      updated[idx] = inf;
    });

    // 记录本次导入批次（用于撤销）
    const batchId = Date.now();
    const batchTime = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    const batchRecords = matched.map(r => ({
      influencerId: r.influencerId,
      product: r.product,
      date: r.date,
      action: r.action,
      prevOrders: r.prevOrders ?? null,
      newOrders: r.newOrders ?? r.orders,
    }));
    const newBatch = { id: batchId, time: batchTime, count: matched.length, records: batchRecords };
    saveBatches([newBatch, ...importBatches].slice(0, 20)); // 最多保留20批

    onSave(updated);
    // 未匹配的追加到现有未匹配库（去重：同一达人+产品+日期只保留最新）
    const mergedUnmatched = [...unmatchedVideos];
    newUnmatched.forEach(nr => {
      const ei = mergedUnmatched.findIndex(e => normalize(e.influencerId) === normalize(nr.influencerId) && normalize(e.product) === normalize(nr.product) && normalize(e.date) === normalize(nr.date));
      if (ei >= 0) mergedUnmatched[ei] = nr; else mergedUnmatched.push(nr);
    });
    saveUnmatched(mergedUnmatched);
    setResult({ matched, unmatched: newUnmatched, statusChanges });
  }

  function getVideosByProduct(inf, product) {
    if (!inf.videoRecords?.length) return [];
    if (!product) return inf.videoRecords;
    return inf.videoRecords.filter(v => normalize(v.product) === normalize(product) ||
      normalize(v.product).includes(normalize(product)) || normalize(product).includes(normalize(v.product)));
  }
  function totalOrders(inf, product) { return getVideosByProduct(inf, product).reduce((a, v) => a + (v.orders || 0), 0); }

  // 撤销某批次导入
  function undoBatch(batch) {
    const updated = influencers.map(inf => {
      const batchRecs = batch.records.filter(r => normalize(r.influencerId) === normalize(inf.influencerId));
      if (!batchRecs.length) return inf;
      let vids = [...(inf.videoRecords || [])];
      batchRecs.forEach(r => {
        const vIdx = vids.findIndex(v =>
          normalize(v.product) === normalize(r.product) &&
          normalize(v.date) === normalize(r.date)
        );
        if (vIdx === -1) return;
        if (r.action === "新增") {
          // 新增的记录直接删除
          vids = vids.filter((_, i) => i !== vIdx);
        } else if (r.action === "更新" && r.prevOrders !== null) {
          // 更新的记录恢复原值
          vids = vids.map((v, i) => i === vIdx ? { ...v, orders: r.prevOrders } : v);
        }
      });
      return { ...inf, videoRecords: vids };
    });
    onSave(updated);
    saveBatches(importBatches.filter(b => b.id !== batch.id));
    setConfirmUndoBatch(null);
  }

  const withVideos = influencers.filter(inf => inf.videoRecords?.length);
  // 未匹配视频按达人分组
  const unmatchedByCreator = useMemo(() => {
    const map = {};
    unmatchedVideos.forEach(v => {
      if (!map[v.influencerId]) map[v.influencerId] = [];
      map[v.influencerId].push(v);
    });
    return map;
  }, [unmatchedVideos]);

  return (
    <div>
      {/* ── 导入批次撤销面板 ── */}
      {importBatches.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowBatches(!showBatches)} style={{
            fontSize: 12, padding: "5px 14px", borderRadius: 20,
            border: `1.5px solid ${T.border}`, background: "transparent",
            color: T.muted, cursor: "pointer", fontFamily: "inherit",
          }}>
            {showBatches ? "▲" : "▼"} 导入历史（{importBatches.length} 批）· 点击撤销
          </button>
          {showBatches && (
            <Card style={{ marginTop: 8 }}>
              {importBatches.map(batch => (
                <div key={batch.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 0", borderBottom: `1px solid ${T.border}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{batch.time}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                      成功导入 {batch.count} 条记录
                    </div>
                  </div>
                  {confirmUndoBatch === batch.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small danger onClick={() => undoBatch(batch)}>确认撤销</Btn>
                      <Btn small onClick={() => setConfirmUndoBatch(null)}>取消</Btn>
                    </div>
                  ) : (
                    <Btn small danger onClick={() => setConfirmUndoBatch(batch.id)}>撤销这批</Btn>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      <SectionLabel>上传视频数据文件</SectionLabel>
      <Card>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 10, lineHeight: 1.7 }}>
          支持 <strong style={{ color: T.text }}>CSV / TSV</strong> 格式，必须包含列：
          <span style={{ color: T.accent, fontWeight: 600 }}> 达人ID · 合作产品 · 视频发布时间 · 成交件数</span>
        </div>
        <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{ fontSize: 13, color: T.muted, marginBottom: 12, display: "block" }} />
        {preview.length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>
              识别到 <span style={{ color: T.accent, fontWeight: 700 }}>{preview.length}</span> 条数据，预览前5行：
            </div>
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["达人ID","合作产品","发布时间","成交件数"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: T.muted, borderBottom: `1.5px solid ${T.border}`, whiteSpace: "nowrap", fontWeight: 600 }}>{h}</th>
                ))}</tr></thead>
                <tbody>{preview.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {[r.influencerId, r.product, r.date, r.orders].map((v, j) => (
                      <td key={j} style={{ padding: "6px 10px", color: T.text, borderBottom: `1px solid ${T.border}` }}>{v}</td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <Btn accent onClick={runImport} style={{ width: "100%" }}>导入并匹配到 CRM（{preview.length} 条）</Btn>
          </div>
        )}
      </Card>

      {/* 导入结果 */}
      {result && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Card style={{ borderColor: `${T.success}44`, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: T.success, marginBottom: 4, fontWeight: 700 }}>匹配成功</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>{result.matched.length}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>新增 {result.matched.filter(r => r.action === "新增").length} · 更新 {result.matched.filter(r => r.action === "更新").length}</div>
            </Card>
            <Card style={{ borderColor: result.unmatched.length ? `${T.warning}44` : T.border, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: result.unmatched.length ? T.warning : T.muted, marginBottom: 4, fontWeight: 700 }}>未匹配（已存入达人自拍记录）</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>{result.unmatched.length}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{result.unmatched.length ? "非CRM达人 或 达人已改名" : "全部匹配成功"}</div>
            </Card>
          </div>

          {/* 状态变更摘要 */}
          {result.statusChanges && result.statusChanges.length > 0 && (
            <Card style={{ marginBottom: 12, borderColor: `${T.accent}44` }}>
              <div style={{ fontSize: 12, color: T.accent, marginBottom: 4, fontWeight: 700 }}>本次状态变更（{result.statusChanges.length} 人）</div>
              <div style={{ fontSize: 11, color: T.hint, marginBottom: 10 }}>
                {(() => {
                  const toPublished = result.statusChanges.filter(s => s.to === "已发布").length;
                  const toRepost = result.statusChanges.filter(s => s.to === "待复投").length;
                  const parts = [];
                  if (toPublished) parts.push(`${toPublished} 人升为「已发布」`);
                  if (toRepost) parts.push(`${toRepost} 人升为「待复投」`);
                  return parts.join(" · ");
                })()}
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto" }}>
                {result.statusChanges.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                    <span style={{ color: T.text, fontWeight: 600, minWidth: 110 }}>{s.influencerId}</span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, padding: "1px 8px", borderRadius: 10, background: `${STATUS_COLORS[s.from] || T.muted}15`, color: STATUS_COLORS[s.from] || T.muted }}>{s.from}</span>
                      <span style={{ color: T.hint }}>→</span>
                      <span style={{ fontSize: 12, padding: "1px 8px", borderRadius: 10, background: `${STATUS_COLORS[s.to] || T.muted}18`, color: STATUS_COLORS[s.to] || T.muted, fontWeight: 700 }}>{s.to}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {result.matched.length > 0 && (
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.success, marginBottom: 8, fontWeight: 700 }}>匹配明细</div>
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {result.matched.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                    <span style={{ color: T.text, minWidth: 110 }}>{r.influencerId}</span>
                    <span style={{ color: T.muted, minWidth: 80 }}>{r.product}</span>
                    <span style={{ color: T.hint }}>{r.date}</span>
                    <span style={{ color: T.text, marginLeft: "auto" }}>{r.orders} 件</span>
                    <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: r.action === "新增" ? `${T.success}18` : `${T.info}18`, color: r.action === "新增" ? T.success : T.info }}>
                      {r.action}{r.action === "更新" && r.prevOrders !== r.newOrders ? ` ${r.prevOrders}→${r.newOrders}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* CRM 视频记录 */}
      {withVideos.length > 0 && (
        <div>
          <SectionLabel>CRM 达人视频记录（{withVideos.length} 位）</SectionLabel>
          {withVideos.map(inf => {
            const isExp = viewId === inf.id;
            const prods = [...new Set((inf.videoRecords || []).map(v => v.product))];
            return (
              <Card key={inf.id} style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setViewId(isExp ? null : inf.id)}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{inf.influencerId}</span>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: `${getGrade(inf.score||0).color}18`, color: getGrade(inf.score||0).color, fontWeight: 700 }}>{inf.grade}</span>
                  <span style={{ fontSize: 13, color: T.muted }}>{inf.product}</span>
                  <span style={{ fontSize: 12, color: T.hint, marginLeft: "auto" }}>{(inf.videoRecords||[]).length} 条 · {inf.videoRecords.reduce((a,v)=>a+(v.orders||0),0)} 件</span>
                  <span style={{ fontSize: 13, color: T.muted }}>{isExp ? "▲" : "▼"}</span>
                </div>
                {isExp && (
                  <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 12, paddingTop: 12 }}>
                    {prods.map(prod => {
                      const vids = getVideosByProduct(inf, prod).sort((a, b) => a.date.localeCompare(b.date));
                      const total = totalOrders(inf, prod);
                      return (
                        <div key={prod} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{prod || "（未知产品）"}</span>
                            <span style={{ fontSize: 12, padding: "2px 9px", borderRadius: 20, background: `${T.accent}18`, color: T.accent, fontWeight: 700, marginLeft: "auto" }}>累计 {total} 件</span>
                            <Btn small danger onClick={() => { const upd = influencers.map(i => i.id === inf.id ? { ...i, videoRecords: (i.videoRecords||[]).filter(v => normalize(v.product) !== normalize(prod)) } : i); onSave(upd); }}>删除此产品</Btn>
                          </div>
                          {vids.map((v, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "#FEF6FA", marginBottom: 5, fontSize: 13 }}>
                              <span style={{ color: T.muted, minWidth: 50 }}>视频{i+1}</span>
                              <span style={{ color: T.hint }}>{v.date}</span>
                              <span style={{ marginLeft: "auto", color: v.orders > 0 ? T.success : T.muted, fontWeight: v.orders > 0 ? 600 : 400 }}>{v.orders} 件</span>
                              <button onClick={() => { const upd = influencers.map(i => i.id === inf.id ? { ...i, videoRecords: (i.videoRecords||[]).filter(vr => !(normalize(vr.product) === normalize(prod) && normalize(vr.date) === normalize(v.date))) } : i); onSave(upd); }} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${T.danger}55`, background: "transparent", color: T.danger, cursor: "pointer", fontFamily: "inherit" }}>删除</button>
                            </div>
                          ))}
                          <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: 10, marginTop: 4 }}>
                            <span style={{ fontSize: 13, color: T.muted }}>总计 </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginLeft: 6 }}>{total} 件</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 非CRM达人视频记录（达人自购自拍 / 改名未匹配） */}
      {Object.keys(unmatchedByCreator).length > 0 && (
        <div>
          <SectionLabel>
            非CRM达人视频记录（{unmatchedVideos.length} 条）
            <span style={{ fontSize: 11, color: T.hint, fontWeight: 400, marginLeft: 8, textTransform: "none" }}>达人自购自拍 · 改名未匹配 · 不在寄样范围内</span>
          </SectionLabel>
          <Card style={{ borderColor: `${T.warning}33`, marginBottom: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, color: T.warning, lineHeight: 1.7 }}>
              💡 如果某位达人是因为改名导致未匹配，可以去 <strong>CRM 管理</strong> 里找到该达人，点击「管理曾用名」添加她的旧名字，下次导入时即可自动匹配。
            </div>
          </Card>
          {Object.entries(unmatchedByCreator).map(([creatorId, vids]) => {
            const isExp = unmatchedExpanded === creatorId;
            const total = vids.reduce((a, v) => a + (v.orders || 0), 0);
            const byProduct = {};
            vids.forEach(v => { if (!byProduct[v.product]) byProduct[v.product] = []; byProduct[v.product].push(v); });
            return (
              <Card key={creatorId} style={{ padding: "12px 14px", borderColor: `${T.warning}33` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setUnmatchedExpanded(isExp ? null : creatorId)}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{creatorId}</span>
                  <Badge label="非CRM达人" color={T.warning} />
                  <span style={{ fontSize: 12, color: T.hint, marginLeft: "auto" }}>{vids.length} 条视频 · {total} 件成交</span>
                  <span style={{ fontSize: 13, color: T.muted }}>{isExp ? "▲" : "▼"}</span>
                </div>
                {isExp && (
                  <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 12, paddingTop: 12 }}>
                    {Object.entries(byProduct).map(([prod, pvids]) => {
                      const prodTotal = pvids.reduce((a, v) => a + (v.orders || 0), 0);
                      return (
                        <div key={prod} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{prod || "（未知产品）"}</span>
                            <span style={{ fontSize: 12, padding: "2px 9px", borderRadius: 20, background: `${T.warning}15`, color: T.warning, fontWeight: 700, marginLeft: "auto" }}>累计 {prodTotal} 件</span>
                          </div>
                          {pvids.sort((a, b) => a.date.localeCompare(b.date)).map((v, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "#FFFBF0", marginBottom: 5, fontSize: 13 }}>
                              <span style={{ color: T.muted, minWidth: 50 }}>视频{i+1}</span>
                              <span style={{ color: T.hint }}>{v.date}</span>
                              <span style={{ marginLeft: "auto", color: v.orders > 0 ? T.success : T.muted, fontWeight: v.orders > 0 ? 600 : 400 }}>{v.orders} 件</span>
                              <button onClick={() => saveUnmatched(unmatchedVideos.filter(uv => !(normalize(uv.influencerId) === normalize(creatorId) && normalize(uv.product) === normalize(prod) && normalize(uv.date) === normalize(v.date))))}
                                style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${T.danger}55`, background: "transparent", color: T.danger, cursor: "pointer", fontFamily: "inherit" }}>删除</button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <Btn small danger onClick={() => saveUnmatched(unmatchedVideos.filter(v => normalize(v.influencerId) !== normalize(creatorId)))}>删除此达人全部记录</Btn>
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

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 7: VIRAL VIDEO ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

