import { useState } from "react";
import { T } from "../constants/tokens.js";
import { CRM_STATUSES, STATUS_COLORS, GRADE_ORDER } from "../constants/crm.js";
import { SCORE_DIMS, SCORE_DIM_ORDER, getGrade } from "../constants/scoring.js";
import { normalize, matchProduct } from "../lib/utils.js";
import { Inp, Btn, Card, MetricCard, Badge } from "../components/ui/index.jsx";

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

export default function CRMModule({ influencers, onSave }) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [aliasInputs, setAliasInputs] = useState({});

  const filtered = influencers
    .filter(i => {
      const matchStatus = filter === "ALL" || i.crmStatus === filter;
      const matchSearch = !search || i.influencerId?.toLowerCase().includes(search.toLowerCase()) || i.bd?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      // 统一日期格式再比较（兼容 2026/6/1 和 2026-06-04 两种格式）
      const norm = s => {
        if (!s) return "";
        const parts = s.replace(/\//g, "-").split("-");
        if (parts.length !== 3) return s;
        return `${parts[0]}-${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}`;
      };
      const da = norm(a.shipDate || a.date);
      const db = norm(b.shipDate || b.date);
      return db.localeCompare(da); // 最近寄样在最前
    });

  function updateStatus(id, status) { onSave(influencers.map(i => i.id === id ? { ...i, crmStatus: status } : i)); }
  function updateField(id, field, value) { onSave(influencers.map(i => i.id === id ? { ...i, [field]: value } : i)); }
  function deleteRecord(id) { onSave(influencers.filter(i => i.id !== id)); setConfirmDelete(null); setExpanded(null); }

  const statusCounts = {};
  CRM_STATUSES.forEach(s => { statusCounts[s] = influencers.filter(i => i.crmStatus === s).length; });
  const orderedDims = SCORE_DIM_ORDER.map(id => SCORE_DIMS.find(d => d.id === id)).filter(Boolean);

  return (
    <div>
      {/* 顶部统计 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {[["总达人", influencers.length], ["已寄样", statusCounts["已寄样"] || 0], ["已发布", statusCounts["已发布"] || 0], ["待复投", statusCounts["待复投"] || 0]].map(([l, v]) => (
          <MetricCard key={l} label={l} value={v} />
        ))}
      </div>

      {/* 状态筛选 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["ALL", ...CRM_STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ fontSize: 11, padding: "4px 11px", borderRadius: 20, border: `1px solid ${filter === s ? (STATUS_COLORS[s] || T.accent) : T.border}`, background: filter === s ? `${STATUS_COLORS[s] || T.accent}18` : "transparent", color: filter === s ? (STATUS_COLORS[s] || T.accent) : T.muted, cursor: "pointer", fontFamily: "inherit" }}>
            {s === "ALL" ? `全部 (${influencers.length})` : `${s} (${statusCounts[s] || 0})`}
          </button>
        ))}
      </div>

      {/* 搜索 + 导出 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Inp value={search} onChange={setSearch} placeholder="搜索达人 ID 或跟进人…" style={{ flex: 1 }} />
        <Btn onClick={() => exportCSV(influencers)} small>导出 CSV</Btn>
      </div>

      {/* 记录列表 */}
      {filtered.length === 0
        ? <div style={{ textAlign: "center", color: T.muted, padding: "60px 0" }}>暂无记录</div>
        : filtered.map(inf => {
          const g = getGrade(inf.score || 0);
          const isExp = expanded === inf.id;
          return (
            <Card key={inf.id} style={{ padding: "12px 14px" }}>
              {/* 行头 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setExpanded(isExp ? null : inf.id)}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{inf.influencerId}</span>
                <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${g.color}22`, color: g.color }}>{inf.grade}</span>
                <span style={{ fontSize: 12, padding: "2px 9px", borderRadius: 20, background: `${STATUS_COLORS[inf.crmStatus] || T.hint}22`, color: STATUS_COLORS[inf.crmStatus] || T.hint }}>{inf.crmStatus || "待接触"}</span>
                {inf.bd && <span style={{ fontSize: 11, color: T.muted }}>跟进：{inf.bd}</span>}
                {inf.product && <span style={{ fontSize: 11, color: T.hint }}>{inf.product}</span>}
                <span style={{ fontSize: 11, color: T.hint, marginLeft: "auto" }}>{inf.date}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{isExp ? "▲" : "▼"}</span>
              </div>

              {/* 展开详情 */}
              {isExp && (
                <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 12, paddingTop: 12 }}>

                  {/* 评分维度详情 */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>评分详情（综合 {inf.score} 分）</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {orderedDims.map(d => {
                        const ds = inf.dimScores?.[d.id];
                        return (
                          <div key={d.id} style={{ background: T.surface, borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>{d.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>{ds ? `${ds.raw}/${ds.max}` : "—"}</div>
                            {ds && <div style={{ fontSize: 10, color: T.hint, marginTop: 1 }}>换算 {ds.score100}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 手动修改等级 */}
                  <div style={{ marginBottom: 12, padding: "12px 14px", background: `${T.accent}08`, border: `1.5px solid ${T.accent}33`, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginBottom: 8 }}>手动修改等级</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["S", "A+", "A", "B", "C"].map(gr => {
                        const grColors = { S: "#0EA371", "A+": "#E84B7C", A: "#9D5BD2", B: "#E8923B", C: "#E0455E" };
                        const grScores = { S: 90, "A+": 80, A: 70, B: 55, C: 0 };
                        const isActive = inf.grade === gr;
                        return (
                          <button key={gr} onClick={() => onSave(influencers.map(i => i.id === inf.id ? { ...i, grade: gr, score: grScores[gr] } : i))}
                            style={{
                              fontSize: 14, fontWeight: 700, padding: "6px 18px", borderRadius: 20,
                              border: `2px solid ${isActive ? grColors[gr] : T.border}`,
                              background: isActive ? `${grColors[gr]}22` : "#FEF6FA",
                              color: isActive ? grColors[gr] : T.muted,
                              cursor: "pointer", fontFamily: "inherit",
                            }}
                          >{gr}</button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: T.hint, marginTop: 6 }}>手动设置后，评分维度数据保持不变，只更新显示等级</div>
                  </div>

                  {/* 基础信息只读展示 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[["达人 ID", inf.influencerId], ["跟进人", inf.bd || "—"], ["寄样产品", inf.product || "—"], ["联系方式", inf.contact || "—"], ["寄样日期", inf.shipDate || inf.date || "—"]].map(([l, v]) => (
                      <div key={l} style={{ background: T.surface, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>{l}</div>
                        <div style={{ fontSize: 13, color: T.text }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* 合作状态更新 */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>合作状态</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {CRM_STATUSES.map(s => {
                        // 待复投只能由系统自动设置，不允许手动点选（除非当前就是待复投要升为复投完成）
                        const isAutoOnly = s === "待复投";
                        return (
                          <button key={s} onClick={() => !isAutoOnly && updateStatus(inf.id, s)}
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20,
                              border: `1px solid ${inf.crmStatus === s ? STATUS_COLORS[s] : T.border}`,
                              background: inf.crmStatus === s ? `${STATUS_COLORS[s]}22` : "transparent",
                              color: inf.crmStatus === s ? STATUS_COLORS[s] : isAutoOnly ? T.hint : T.muted,
                              cursor: isAutoOnly ? "default" : "pointer", fontFamily: "inherit",
                              opacity: isAutoOnly ? 0.5 : 1,
                            }} title={isAutoOnly ? "由系统自动标记，出单≥3件触发" : ""}
                          >{s}</button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: T.hint, marginTop: 5 }}>
                      【待复投】由系统自动触发（累计出单 ≥ 3 件）· 手动更新为【复投完成】后解除
                    </div>
                  </div>

                  {/* 视频回收同步数据（只读，自动计算） */}
                  {(() => {
                    const vids = (inf.videoRecords || []).filter(v =>
                      !inf.product || normalize(v.product) === normalize(inf.product) ||
                      normalize(v.product).includes(normalize(inf.product)) ||
                      normalize(inf.product).includes(normalize(v.product))
                    );
                    const videoCount = vids.length;
                    const totalOrd = vids.reduce((a, v) => a + (v.orders || 0), 0);
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                        {[["发布视频个数", videoCount, "自动同步自视频回收"], ["累计成交件数", totalOrd, "该达人×本产品总计"]].map(([l, v, sub]) => (
                          <div key={l} style={{ background: T.surface, borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>{l}</div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: l === "累计成交件数" && v >= 3 ? T.accent : T.text }}>{v}</div>
                            <div style={{ fontSize: 10, color: T.hint, marginTop: 2 }}>{sub}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 备注 */}
                  {inf.note && (
                    <div style={{ fontSize: 12, color: T.muted, padding: "8px 10px", background: T.surface, borderRadius: 6, marginBottom: 12 }}>备注：{inf.note}</div>
                  )}

                  {/* 曾用名管理 */}
                  <div style={{ marginBottom: 12, padding: "12px 14px", background: "#FFFBF0", border: `1.5px solid ${T.warning}33`, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>
                      曾用名管理
                      <span style={{ fontSize: 11, color: T.hint, fontWeight: 400, marginLeft: 8 }}>改名后添加旧ID，视频回收导入时自动匹配</span>
                    </div>
                    {/* 已有曾用名列表 */}
                    {(inf.aliases || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {(inf.aliases || []).map((alias, ai) => (
                          <div key={ai} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "3px 10px", borderRadius: 20, background: `${T.warning}15`, border: `1px solid ${T.warning}55`, color: T.text }}>
                            <span>{alias}</span>
                            <button onClick={() => {
                              const newAliases = (inf.aliases || []).filter((_, idx) => idx !== ai);
                              onSave(influencers.map(i => i.id === inf.id ? { ...i, aliases: newAliases } : i));
                            }} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 添加新曾用名 */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <Inp
                        value={aliasInputs[inf.id] || ""}
                        onChange={v => setAliasInputs(prev => ({ ...prev, [inf.id]: v }))}
                        placeholder="输入旧名字 / 改名前的ID…"
                        style={{ flex: 1, fontSize: 13 }}
                      />
                      <Btn small onClick={() => {
                        const val = (aliasInputs[inf.id] || "").trim();
                        if (!val) return;
                        const newAliases = [...(inf.aliases || []), val];
                        onSave(influencers.map(i => i.id === inf.id ? { ...i, aliases: newAliases } : i));
                        setAliasInputs(prev => ({ ...prev, [inf.id]: "" }));
                      }} style={{ whiteSpace: "nowrap" }}>+ 添加曾用名</Btn>
                    </div>
                  </div>

                  {/* 删除按钮 */}
                  {confirmDelete === inf.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: `${T.danger}12`, borderRadius: 8, border: `1px solid ${T.danger}33` }}>
                      <span style={{ fontSize: 12, color: T.danger, flex: 1 }}>确认删除这条记录？此操作不可撤销。</span>
                      <Btn small danger onClick={() => deleteRecord(inf.id)}>确认删除</Btn>
                      <Btn small onClick={() => setConfirmDelete(null)}>取消</Btn>
                    </div>
                  ) : (
                    <Btn small danger onClick={() => setConfirmDelete(inf.id)}>删除记录</Btn>
                  )}
                </div>
              )}
            </Card>
          );
        })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: PRODUCT MANAGEMENT
// 板块一：产品基础档案（内部名称、商品名、核心卖点、推荐达人画像、病毒性关键词）
// 板块二：推广状态
// 注：达人画像和病毒性关键词由爆款分析模块（⑥）写入，产品管理只展示
// ══════════════════════════════════════════════════════════════════════════════
const PRODUCT_STATUSES = ["爆款主推款", "主推款", "可卖款", "测款", "清仓款"];
const PS_COLORS = {
  "爆款主推款": "#DC2626", "主推款": "#0D9E6A",
  "可卖款": "#5B8DEF", "测款": "#E8923B", "清仓款": "#A89098",
};


