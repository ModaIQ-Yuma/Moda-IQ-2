import { useState } from "react";
import { T } from "../constants/tokens.js";
import { SCORE_DIMS, SCORE_DIM_ORDER, initSel, calcScore, getGrade } from "../constants/scoring.js";
import { normalize } from "../lib/utils.js";
import { Inp, Sel, Btn, Card } from "../components/ui/index.jsx";
import { todayCST } from "../lib/utils.js";

export default function ScoreModule({ influencers, onSave, products }) {
  const [uid, setUid] = useState("");
  const [productId, setProductId] = useState("");   // internalName 作为 key
  const [bd, setBd] = useState("");
  const [contact, setContact] = useState("");   // 联系方式（非必填）
  const [initStatus, setInitStatus] = useState("待接触");  // 保存时的初始状态
  const [note, setNote] = useState("");
  // 寄样日期：默认今天（东八区），可手动改成任意过去日期
  const todayCST = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD
  const [shipDate, setShipDate] = useState(todayCST());
  const [sel, setSel] = useState(initSel);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);   // 往期合作记录浮窗

  const { score, dimScores, coverage } = calcScore(sel);
  const grade = score !== null ? getGrade(score) : null;
  const orderedDims = SCORE_DIM_ORDER.map(id => SCORE_DIMS.find(d => d.id === id)).filter(Boolean);
  const selectedProduct = products.find(p => p.internalName === productId);

  // ── 往期合作记录检测：按纯达人ID匹配（含曾用名）──────────────────────────
  const pastRecords = uid.trim()
    ? influencers.filter(inf => {
        const idMatch = normalize(inf.influencerId) === normalize(uid);
        const aliasMatch = (inf.aliases || []).some(a => normalize(a) === normalize(uid));
        return idMatch || aliasMatch;
      })
    : [];

  // 计算每条往期记录针对其产品的累计销量
  function pastOrders(inf) {
    const vids = (inf.videoRecords || []).filter(v =>
      !inf.product || normalize(v.product) === normalize(inf.product) ||
      normalize(v.product).includes(normalize(inf.product)) ||
      normalize(inf.product).includes(normalize(v.product))
    );
    return vids.reduce((a, v) => a + (v.orders || 0), 0);
  }

  function pick(dimId, idx, val) { setSaved(false); setSel(p => ({ ...p, [dimId]: { ...p[dimId], [idx]: val } })); }

  function doSave() {
    if (!uid.trim() || score === null) return;
    const rec = {
      id: Date.now(),
      influencerId: uid.trim(),
      product: productId,                                    // 内部名称
      productTitle: selectedProduct?.productTitle || "",     // 商品名，供开发信用
      bd: bd.trim(),
      contact: contact.trim(),
      note: note.trim(),
      score,
      grade: grade.label,
      dimScores,
      date: new Date().toLocaleDateString("zh-CN"),   // 录入日期（创建记录的日期）
      shipDate: shipDate,                               // 寄样日期（可手动编辑，月度追踪按此划周期）
      selections: sel,
      actualGMV: "",
      actualOrders: "",
      crmStatus: initStatus,
    };
    onSave([rec, ...influencers]);
    setSaved(true);
  }

  function doReset() { setUid(""); setProductId(""); setBd(""); setContact(""); setInitStatus("待接触"); setNote(""); setShipDate(todayCST()); setSel(initSel()); setSaved(false); }

  return (
    <div>
      {/* 基础信息：三列 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>达人 ID</div>
          <Inp value={uid} onChange={setUid} placeholder="@username" />
          {pastRecords.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: `${T.warning}12`, border: `1px solid ${T.warning}44`, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: T.warning, fontWeight: 600 }}>⚠ 该达人有 {pastRecords.length} 条往期合作记录</span>
              <button onClick={() => setShowHistory(true)} style={{ fontSize: 12, padding: "2px 10px", borderRadius: 14, border: `1px solid ${T.warning}`, background: "#fff", color: T.warning, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, marginLeft: "auto" }}>查看</button>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>寄样产品</div>
          <Sel value={productId} onChange={setProductId} style={{ width: "100%" }}>
            <option value="">请选择产品…</option>
            {products.map(p => (
              <option key={p.id} value={p.internalName}>{p.internalName}</option>
            ))}
          </Sel>
          {selectedProduct?.productTitle && (
            <div style={{ fontSize: 11, color: T.hint, marginTop: 4 }}>商品名：{selectedProduct.productTitle}</div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>跟进人</div>
          <Inp value={bd} onChange={setBd} placeholder="BD 姓名" />
        </div>
      </div>

      {/* 联系方式（非必填） */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>联系方式 <span style={{ color: T.hint, fontWeight: 400 }}>(选填 · 邮箱 / WhatsApp / IG 等)</span></div>
        <Inp value={contact} onChange={setContact} placeholder="eg. creator@email.com / WhatsApp +1..." />
      </div>

      {/* 寄样日期（可手动编辑，月度追踪按此划周期）*/}
      <div style={{ marginBottom: 16, padding: "12px 14px", background: T.gradSoft, borderRadius: 12, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 6, fontWeight: 600 }}>
          寄样日期 <span style={{ color: T.accent, fontWeight: 700 }}>★</span>
          <span style={{ color: T.hint, fontWeight: 400, marginLeft: 6 }}>月度追踪按此日期划入对应统计周期</span>
        </div>
        <input type="date" value={shipDate} max={todayCST()} onChange={e => { setShipDate(e.target.value); setSaved(false); }}
          style={{ fontSize: 15, padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontFamily: "inherit", color: T.text, background: "#fff", outline: "none" }} />
        <div style={{ fontSize: 12, color: T.hint, marginTop: 6 }}>默认今天。补登记漏掉的达人时，改成实际寄出的那天，就能正确归入当期寄样。</div>
      </div>

      {/* 评分维度：按指定顺序渲染 */}
      {orderedDims.map(dim => (
        <Card key={dim.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{dim.label}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: dim.tag === "客观" ? `${T.success}15` : `${T.a}15`, color: dim.tag === "客观" ? T.success : T.a, fontWeight: 600 }}>{dim.tag}</span>
            <span style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>权重 {Math.round(dim.weight * 100)}%</span>
            {dimScores[dim.id] !== undefined && (
              <span style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>
                {dimScores[dim.id].raw}
                <span style={{ fontSize: 12, color: T.muted, fontWeight: 400 }}>/{dimScores[dim.id].max}</span>
              </span>
            )}
          </div>
          {dim.indicators.map((ind, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: T.muted, width: 115, flexShrink: 0, fontWeight: 500 }}>{ind.label}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ind.opts.map(opt => {
                  const isSel = sel[dim.id][i] === opt.v;
                  const col = opt.v === 0 ? T.danger : opt.v < 50 ? T.warning : T.success;
                  return (
                    <button key={opt.v} onClick={() => pick(dim.id, i, opt.v)} style={{ fontSize: 13, padding: "5px 13px", borderRadius: 20, border: `1.5px solid ${isSel ? col : T.border}`, background: isSel ? `${col}18` : "#FEF6FA", color: isSel ? col : T.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: isSel ? 700 : 500 }}>
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      ))}

      {/* 备注 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>备注</div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="主观印象、加减分理由..." style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px", fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* 结果卡片 */}
      {score !== null && (
        <Card style={{ borderColor: `${grade.color}44` }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 12 }}>
            <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 22, fontWeight: 800, padding: "4px 14px", borderRadius: 9, background: `${grade.color}18`, color: grade.color }}>{grade.label}</span>
            <span style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>覆盖 {Math.round(coverage * 100)}%</span>
          </div>
          <div style={{ height: 5, background: T.border, borderRadius: 3, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${score}%`, background: grade.color, borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
            {orderedDims.map(d => dimScores[d.id] !== undefined && (
              <span key={d.id} style={{ fontSize: 13, padding: "3px 11px", borderRadius: 20, background: "#FDEEF4", border: `1px solid ${T.border}`, color: T.muted, fontWeight: 500 }}>
                {d.label} {dimScores[d.id].raw}/{dimScores[d.id].max}
                <span style={{ color: T.hint }}> ({dimScores[d.id].score100})</span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 15, padding: "10px 14px", borderRadius: 9, background: `${grade.color}12`, color: grade.color, fontWeight: 600 }}>
            {grade.label === "S" ? "全维度优秀，ROI 稳定 — 优先寄样"
              : grade.label === "A+" ? "高匹配高潜力 — 建议寄样并重点跟进"
              : grade.label === "A" ? "主力输出达人 — 正常寄样"
              : grade.label === "B" ? "可测款保覆盖 — 寄样但不重点投入"
              : "运气出单风险高 — 谨慎寄样，先观察"}
          </div>
        </Card>
      )}

      {/* 初始状态选择 */}
      <div style={{ marginBottom: 12, padding: "12px 14px", background: "#FDEEF4", borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: T.muted, fontWeight: 600, marginBottom: 8 }}>保存后该达人的初始状态</div>
        <div style={{ display: "flex", gap: 8 }}>
          {["待接触", "已寄样"].map(s => {
            const col = s === "已寄样" ? T.warning : T.muted;
            return (
              <button key={s} onClick={() => setInitStatus(s)} style={{
                flex: 1, fontSize: 14, padding: "9px 16px", borderRadius: 8,
                border: `1.5px solid ${initStatus === s ? col : T.border}`,
                background: initStatus === s ? `${col}15` : "#fff",
                color: initStatus === s ? col : T.muted,
                cursor: "pointer", fontFamily: "inherit", fontWeight: initStatus === s ? 700 : 500,
              }}>{initStatus === s ? "● " : ""}{s}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={doSave} accent disabled={!uid.trim() || score === null} style={{ flex: 1 }}>{saved ? `✓ 已保存（${initStatus}）` : "保存记录"}</Btn>
        <Btn onClick={doReset}>清空</Btn>
      </div>

      {/* 往期合作记录浮动窗口 */}
      {showHistory && (
        <div onClick={() => setShowHistory(false)} style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(13,15,20,0.35)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.6)", borderRadius: 16,
            boxShadow: "0 12px 48px rgba(0,0,0,0.18)",
            padding: "22px 24px", maxWidth: 560, width: "100%", maxHeight: "75vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>往期合作记录</span>
              <button onClick={() => setShowHistory(false)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, color: T.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>{uid} · 共 {pastRecords.length} 次</div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${T.border}` }}>
                  {["产品", "累计销量", "跟进人", "登记等级"].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 0 ? "left" : "center", padding: "8px 10px", color: T.muted, fontWeight: 700, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastRecords.map((inf, i) => {
                  const g = getGrade(inf.score || 0);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 10px", fontWeight: 600, color: T.text }}>{inf.product || "—"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: pastOrders(inf) > 0 ? T.success : T.muted }}>{pastOrders(inf)} 件</td>
                      <td style={{ padding: "10px 10px", textAlign: "center", color: T.muted }}>{inf.bd || "—"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 9px", borderRadius: 8, background: `${g.color}18`, color: g.color }}>{inf.grade}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: OUTREACH & ROI CALCULATOR
// ══════════════════════════════════════════════════════════════════════════════

// 多选标签组件
function TagGroup({ options, selected, onToggle, color = T.info }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const on = selected.includes(o);
        return (
          <button key={o} onClick={() => onToggle(o)} style={{
            fontSize: 13, padding: "5px 13px", borderRadius: 20,
            border: `1.5px solid ${on ? color : T.border}`,
            background: on ? `${color}18` : "#FEF6FA",
            color: on ? color : T.muted, cursor: "pointer", fontFamily: "inherit",
            fontWeight: on ? 700 : 500,
          }}>{o}</button>
        );
      })}
    </div>
  );
}

// 精简后的标签选项（保留最常用、区分度高的）
const BODY_TYPES   = ["petite","curvy","plus-size","midsize","athletic","hourglass","postpartum body","tall girl"];
const STYLE_TYPES  = ["clean girl","classy","casual chic","feminine","soft girl","hot mom style","baddie","luxury vibe"];
const CONTENT_STYLES = ["try-on haul","outfit inspo","GRWM","relatable","body positivity","aesthetic","confidence-focused"];
const PERSONA_TYPES  = ["mom creator","working mom","gym girl","corporate girl","Latina creator","fashion reviewer"];
const OFFER_TYPES = ["免费样品","佣金合作","固定费用"];
const CHANNELS = ["DM","Email","WhatsApp","商家后台","平台定向邀约信函"];
const FORMATS = ["群发","定制"];
const TONES = ["热情","商业","随意","真挚","礼貌","简洁直接"];

const CHANNEL_HINTS = {
  "DM": "简短有力，前两句必须抓住注意力，避免长段落，像朋友发消息",
  "Email": "可以更完整，有主题行、开场、正文、结尾CTA，专业但不冷漠",
  "WhatsApp": "口语化，可以用emoji，像真实对话，简洁",
  "商家后台": "平台官方语境，措辞正式，突出合作价值与品牌背书",
  "平台定向邀约信函": "正式邀约函格式，有称谓、品牌介绍、合作条款、签名",
};


