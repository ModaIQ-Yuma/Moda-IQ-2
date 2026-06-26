import { useState } from "react";
import { T } from "../constants/tokens.js";
import { useAI } from "../hooks/useAI.js";
import { Inp, Sel, Btn, Card, Badge, SectionLabel, TagGroup } from "../components/ui/index.jsx";

// ─── 开发信模块常量 ───────────────────────────────────────────────────────────
const BODY_TYPES     = ["petite","curvy","plus-size","midsize","athletic","hourglass","postpartum body","tall girl"];
const STYLE_TYPES    = ["clean girl","classy","casual chic","feminine","soft girl","hot mom style","baddie","luxury vibe"];
const CONTENT_STYLES = ["try-on haul","outfit inspo","GRWM","relatable","body positivity","aesthetic","confidence-focused"];
const PERSONA_TYPES  = ["mom creator","working mom","gym girl","corporate girl","Latina creator","fashion reviewer"];
const OFFER_TYPES    = ["免费样品","佣金合作","固定费用"];
const CHANNELS       = ["DM","Email","WhatsApp","商家后台","平台定向邀约信函"];
const FORMATS        = ["群发","定制"];
const TONES          = ["热情","商业","随意","真挚","礼貌","简洁直接"];

const CHANNEL_HINTS = {
  "DM":               "简短有力，前两句必须抓住注意力，避免长段落，像朋友发消息",
  "Email":            "可以更完整，有主题行、开场、正文、结尾CTA，专业但不冷漠",
  "WhatsApp":         "口语化，可以用emoji，像真实对话，简洁",
  "商家后台":         "平台官方语境，措辞正式，突出合作价值与品牌背书",
  "平台定向邀约信函": "正式邀约函格式，有称谓、品牌介绍、合作条款、签名",
};

// ─── CRM 达人下拉提示组件 ─────────────────────────────────────────────────────
// 职责：只做搜索+展示+选择，不包含任何其他逻辑
function InfluencerDropdown({ query, influencers, onSelect }) {
  if (!query.trim() || !influencers?.length) return null;

  const q = query.toLowerCase().trim();
  const matches = influencers
    .filter(inf => inf.influencerId?.toLowerCase().includes(q))
    .slice(0, 6); // 最多显示6条，避免列表过长

  if (!matches.length) return null;

  return (
    <div style={{
      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
      background: "#fff", border: `1.5px solid ${T.border}`,
      borderRadius: 10, boxShadow: "0 4px 20px rgba(232,75,124,0.12)",
      marginTop: 4, overflow: "hidden",
    }}>
      {matches.map(inf => {
        // 计算该达人的累计出单数
        const totalOrders = (inf.videoRecords || []).reduce((sum, v) => sum + (v.orders || 0), 0);
        return (
          <div
            key={inf.id}
            onClick={() => onSelect(inf.influencerId)}
            style={{
              padding: "10px 14px", cursor: "pointer",
              borderBottom: `1px solid ${T.border}`,
              transition: "background 0.1s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#FFF0F5"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                {inf.influencerId}
              </span>
              {inf.grade && (
                <span style={{
                  fontSize: 11, padding: "1px 7px", borderRadius: 10,
                  background: `${T.accent}15`, color: T.accent, fontWeight: 700,
                }}>{inf.grade}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: T.muted }}>
              {inf.product && (
                <span>📦 {inf.product}</span>
              )}
              <span style={{ color: totalOrders > 0 ? T.success : T.hint }}>
                🛒 累计出单 {totalOrders} 单
              </span>
              {inf.crmStatus && (
                <span>状态：{inf.crmStatus}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OutreachModule({ outreach, onSave, products, onSaveContact, contacts, onSaveContacts, influencers }) {
  const [tab, setTab] = useState("msg");

  // ── 板块一：达人信息 ──────────────────────────────────────────────────────
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [bodyTypes, setBodyTypes] = useState([]);
  const [styleTypes, setStyleTypes] = useState([]);
  const [contentStyles, setContentStyles] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [keyTrait, setKeyTrait] = useState("");   // 你最看重达人什么特征

  // ── 达人ID下拉提示 state（新增2个）────────────────────────────────────────
  const [showDropdown, setShowDropdown] = useState(false);

  // ── 板块二：产品信息 ──────────────────────────────────────────────────────
  const [productName, setProductName] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [offers, setOffers] = useState([]);
  const [commissionPct, setCommissionPct] = useState("");
  const [fixedFee, setFixedFee] = useState("");

  // ── 板块三：生成设置 ──────────────────────────────────────────────────────
  const [channel, setChannel] = useState("DM");
  const [format, setFormat] = useState("定制");
  const [extraReq, setExtraReq] = useState("");
  const [tone, setTone] = useState("热情");
  const [msgStyle, setMsgStyle] = useState("quality"); // "efficiency" | "quality"

  // ── 结果 ──────────────────────────────────────────────────────────────────
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [finalText, setFinalText] = useState("");   // 最终版文本
  const [finalSaved, setFinalSaved] = useState(false);
  // 多渠道建联管理：导出日期范围 + 渠道筛选
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [contactChannelFilter, setContactChannelFilter] = useState("ALL");
  const [contactDel, setContactDel] = useState(null);

  function toggle(arr, setArr, val) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  // ── 构建 Prompt ───────────────────────────────────────────────────────────
  function buildPrompt(prevMsg = "", userFeedback = "") {
    const offerStr = offers.map(o => {
      if (o === "佣金合作" && commissionPct) return `${commissionPct}% commission`;
      if (o === "固定费用" && fixedFee) return `$${fixedFee} fixed fee`;
      return o === "免费样品" ? "free product" : o;
    }).join(" + ");

    const selectedProd = products.find(p => p.internalName === productName);
    const displayProductName = selectedProd?.productTitle || productName;

    const channelRules = {
      "DM":        "最多3句，没有废话，像真人发的消息",
      "WhatsApp":  "最多3句，口语化，像朋友发的",
      "Email":     "标题+正文，正文最多6行，每行一个意思",
      "商家后台":  "最多5行，正式但每句有信息量，不寒暄",
      "平台定向邀约信函": "最多8行，邀约函格式，有称谓和结尾，不废话",
    };

    const emailFormat = channel === "Email" ? `
【Email输出格式】
第一行：SUBJECT: [标题]
空一行
正文` : "";

    const revisionBlock = prevMsg ? `【上一版本】\n${prevMsg}\n\n【修改意见】\n${userFeedback}\n\n按意见修改，保留有效的，改掉问题的。` : "";

    // ── 效率型：条件先行公式 ──────────────────────────────────────────────
    if (msgStyle === "efficiency") {
      return `你是一位顶级TikTok美区女装BD。你深知美国达人的沟通习惯：注意力只有2秒，条件不够直接就不读，夸她不够具体就当群发。

【达人参考信息】（用于判断，不是全部写进去）
达人ID: ${uid || "未知"}
身材: ${bodyTypes.join(", ") || "未指定"} | 风格: ${styleTypes.join(", ") || "未指定"}
内容类型: ${contentStyles.join(", ") || "未指定"}
${personas.length ? `人设: ${personas.join(", ")}` : ""}
${keyTrait.trim() ? `\n【★最看重的特征 — 最高优先级，必须作为开发信的核心钩子】\n${keyTrait.trim()}\n（请把这条作为"为什么是她"的核心，其余标签只作辅助。）` : ""}

【产品信息】
产品: ${displayProductName}
卖点: ${sellingPoints || "未填写"}
解决的痛点: ${painPoints || "未填写"}
提供条件: ${offerStr || "free product"}

【渠道规则】
渠道: ${channel} — ${channelRules[channel] || "越短越好"}
形式: ${format === "群发" ? "通用，不提具体内容细节" : "定制，必须有一个只有真正看过她才能说出的具体观察"}
语气: ${tone}
${extraReq ? `额外要求: ${extraReq}` : ""}

【写作公式，严格按此四步顺序执行】

第一步 — 条件先行（第一句 / Email标题）
直接亮出合作条件，数字+产品+她得到什么。
禁止开头：Hi / Hello / I hope / I love your content / My name is / We are a brand
正确示范：
- "$200 fixed + free dress — [一句为什么是她]"
- "Paid collab $250 + [X]% commission — [一个具体钩子]"

第二步 — 为什么是她（一个具体观察，一句话）
从达人信息里选最相关的一个特征，说一句只有看过她才能说的话。
禁止："Your content is amazing" / "I love your style" / "You're perfect for this"
允许："The way you style outfits for [她的具体身材/人设] is exactly what this piece needs"

第三步 — 产品一句话
说清楚产品是什么、解决什么问题。不堆卖点，一句够。

第四步 — CTA收尾（一句）
"Interested?" / "Worth a chat?" / "Let me know if you'd like to try it."

【死规则】
1. 不编造、不猜测她的具体内容，只描述从标签信息可合理推断的真实特征
2. 条件必须出现在第一句或Email标题，不能憋到最后
3. 每一句都要有用，没用的句子直接删掉
${channel === "Email" ? `
【Email输出格式】
第一行：SUBJECT: [条件 + 破折号 + 具体钩子]
空一行
正文` : ""}

${revisionBlock}

直接输出开发信，不要任何前缀说明。英文输出。`;
    }

    // ── 质感型：内容观察开场公式 ──────────────────────────────────────────
    return `You are writing an outreach message for a U.S.-based TikTok fashion creator on behalf of a women's clothing brand.

CREATOR INFO (use for personalization, don't list all of it):
Creator ID: ${uid || "unknown"}
Body type: ${bodyTypes.join(", ") || "not specified"}
Style: ${styleTypes.join(", ") || "not specified"}
Content type: ${contentStyles.join(", ") || "not specified"}
${personas.length ? `Creator persona: ${personas.join(", ")}` : ""}
${keyTrait.trim() ? `\nMOST IMPORTANT TRAIT (highest priority — build the whole message around this):\n${keyTrait.trim()}\nMake this the core of your "why her" angle. Other tags are only supporting details.` : ""}

PRODUCT INFO:
Product: ${displayProductName}
Key selling points: ${sellingPoints || "not filled"}
Pain point solved: ${painPoints || "not filled"}
Offer: ${offerStr || "free product"}

CHANNEL: ${channel} — ${channelRules[channel] || "keep it short"}
FORMAT: ${format === "群发" ? "General — do not reference specific content details" : "Personalized — must include one specific observation that shows you actually watched her content"}
TONE: ${tone}
${extraReq ? `EXTRA REQUIREMENTS: ${extraReq}` : ""}

YOUR GOAL: Make the creator feel three things:
1. "This brand actually watched my content."
2. "This is a real opportunity with value."
3. "This would fit naturally into what I already create."

STRUCTURE (follow this order):

STEP 1 — CONTENT-SPECIFIC OPENING
Start with something specific about her content style or skill — NOT her appearance.
Focus on: a styling format she uses / how her content feels / what makes it work for her audience.
FORBIDDEN: "love your vibe" / "love your aesthetic" / "obsessed with your style" / "you're so talented"
GOOD direction:
- "You're really good at making try-on content feel natural and not staged…"
- "I liked how wearable your styling videos feel — it doesn't look like an ad…"
- "The way you show how pieces actually fit on [her body type] is something a lot of brands miss…"

STEP 2 — INTRODUCE THE OPPORTUNITY (1–2 sentences)
Mention: ${offerStr || "gifting / collab opportunity"}
Make it conversational — NOT a bullet list of terms.
BAD: "We offer: $150 payment, 15% commission"
GOOD: "We'd love to explore a paid collab, and we also offer commission if it feels like a good fit."

STEP 3 — CONNECT PRODUCT TO THEIR CONTENT
One sentence explaining WHY this product fits naturally into her existing content.
Focus on: styling scenarios / audience fit / natural integration / practicality.
Example: "I could really see this fitting into your [content type] content."

STEP 4 — LOW-PRESSURE CLOSING
Casual, respectful, no urgency.
GOOD: "Happy to send more details if interested :)" / "No pressure at all if it's not a fit!" / "Would love to chat if this feels aligned."
BAD: "Looking forward to your reply." / "Please respond ASAP." / "Hope we can cooperate."

RULES:
- NEVER sound like mass outreach
- NEVER write long paragraphs
- NEVER use corporate/supplier language
- NEVER fabricate specific content details you don't actually know
- Keep it concise, human, American-native
- Avoid buzzwords and exaggerated excitement
- Max 1 emoji if any, and only if it feels natural
${channel === "Email" ? `
EMAIL FORMAT:
First line: SUBJECT: [subject line — lead with content observation or natural hook, NOT the price]
Blank line
Body` : ""}

${revisionBlock}

Output the message directly. No prefix or explanation. Write in English.`;
  }

  async function genMessage() {
    if (!uid.trim() && !productName.trim()) return;
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: buildPrompt() }] }),
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || "";
      setMsg(text); setFeedback("");
    } catch { setMsg("生成失败，请重试"); }
    setLoading(false);
  }

  async function refineMessage() {
    if (!feedback.trim() || !msg) return;
    setRefining(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: buildPrompt(msg, feedback) }] }),
      });
      const data = await res.json();
      const text = data.content?.map(c => c.text || "").join("") || "";
      setMsg(text); setFeedback("");
    } catch { setMsg("修改失败，请重试"); }
    setRefining(false);
  }

  function saveRecord() {
    if (!msg) return;
    const rec = {
      id: Date.now(), influencerId: uid, product: productName,
      channel, tone, format, date: new Date().toLocaleDateString("zh-CN"),
      message: msg, bodyTypes, styleTypes, contentStyles,
    };
    onSave([rec, ...outreach]);
  }

  function deleteRecord(id) {
    onSave(outreach.filter(r => r.id !== id));
    setConfirmDel(null);
  }

  // ── ROI 计算 state ────────────────────────────────────────────────────────
  const [roiProduct, setRoiProduct] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [materialCost, setMaterialCost] = useState("");
  const [freightIn, setFreightIn] = useState("");
  const [freightOut, setFreightOut] = useState("");
  const [platformRate, setPlatformRate] = useState("");
  const [companyRate, setCompanyRate] = useState("");
  const [adRate, setAdRate] = useState("");
  const [influencerRate, setInfluencerRate] = useState("");
  const [pitFee, setPitFee] = useState("");

  const sp = parseFloat(salePrice) || 0;
  const mc = parseFloat(materialCost) || 0;
  const fi = parseFloat(freightIn) || 0;
  const fo = parseFloat(freightOut) || 0;
  const pr = parseFloat(platformRate) / 100 || 0;
  const cr = parseFloat(companyRate) / 100 || 0;
  const ar = parseFloat(adRate) / 100 || 0;
  const ir = parseFloat(influencerRate) / 100 || 0;
  const pit = parseFloat(pitFee) || 0;
  const netProfit = sp - mc - fi - fo - sp * (pr + cr + ar + ir);
  const fixedCost = mc + fi + fo;
  const breakEven = netProfit > 0 ? Math.ceil((pit + fixedCost) / netProfit) : null;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["msg", "开发信生成"], ["contacts", "多渠道建联达人管理"], ["roi", "付费回本计算"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: `1px solid ${tab === k ? T.accent : T.border}`, background: tab === k ? `${T.accent}18` : "transparent", color: tab === k ? T.accent : T.muted, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
        ))}
      </div>

      {tab === "msg" && (
        <div>
          {/* ── 板块一：达人信息 ── */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${T.info}22`, color: T.info }}>板块一</span>
              达人信息
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

              {/* 达人ID输入框 + 下拉提示 */}
              <div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>达人 ID <span style={{ color: T.danger }}>*</span></div>
                <div style={{ position: "relative" }}>
                  <input
                    value={uid}
                    onChange={e => { setUid(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="@username"
                    style={{
                      width: "100%", background: "#FEF8FB",
                      border: `1.5px solid ${T.border}`, borderRadius: 10,
                      color: T.text, fontSize: 15, padding: "10px 14px",
                      fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {showDropdown && (
                    <InfluencerDropdown
                      query={uid}
                      influencers={influencers}
                      onSelect={id => { setUid(id); setShowDropdown(false); }}
                    />
                  )}
                </div>
                {/* 点击外部关闭下拉 */}
                {showDropdown && (
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 199 }}
                    onClick={() => setShowDropdown(false)}
                  />
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>邮箱地址 <span style={{ color: T.hint }}>(选填)</span></div>
                <Inp value={email} onChange={setEmail} placeholder="creator@email.com" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>达人身材 <span style={{ color: T.hint }}>(可多选)</span></div>
              <TagGroup options={BODY_TYPES} selected={bodyTypes} onToggle={v => toggle(bodyTypes, setBodyTypes, v)} color={T.info} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>达人风格 <span style={{ color: T.hint }}>(可多选)</span></div>
              <TagGroup options={STYLE_TYPES} selected={styleTypes} onToggle={v => toggle(styleTypes, setStyleTypes, v)} color={T.a} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>内容风格 <span style={{ color: T.hint }}>(可多选)</span></div>
              <TagGroup options={CONTENT_STYLES} selected={contentStyles} onToggle={v => toggle(contentStyles, setContentStyles, v)} color={T.success} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>达人人设 <span style={{ color: T.hint }}>(可多选)</span></div>
              <TagGroup options={PERSONA_TYPES} selected={personas} onToggle={v => toggle(personas, setPersonas, v)} color={T.warning} />
            </div>
            <div style={{ background: `${T.accent}08`, border: `1.5px solid ${T.accent}33`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, color: T.accent, fontWeight: 700, marginBottom: 6 }}>★ 你最看重达人什么特征</div>
              <div style={{ fontSize: 11, color: T.hint, marginBottom: 8 }}>AI 会优先围绕这条来写开发信的核心钩子。留空则根据上面的标签自由发散。</div>
              <textarea value={keyTrait} onChange={e => setKeyTrait(e.target.value)} rows={2}
                placeholder="eg. 她带货转化率特别高 / 她的试穿视频很真实不做作 / 她的粉丝信任度很高..."
                style={{ width: "100%", background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 13px", fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }} />
            </div>
          </Card>

          {/* ── 板块二：产品信息 ── */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${T.warning}22`, color: T.warning }}>板块二</span>
              产品信息
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 5, fontWeight: 600 }}>产品名称 <span style={{ color: T.danger }}>*</span></div>
              <Sel value={productName} onChange={v => {
                setProductName(v);
                const p = products.find(x => x.internalName === v);
                if (p?.keyPoints && !sellingPoints) setSellingPoints(p.keyPoints);
              }} style={{ width: "100%" }}>
                <option value="">请选择产品…</option>
                {products.map(p => <option key={p.id} value={p.internalName}>{p.internalName}</option>)}
              </Sel>
              {products.find(p => p.internalName === productName)?.productTitle && (
                <div style={{ fontSize: 12, color: T.hint, marginTop: 5 }}>
                  商品名（开发信将以此为灵感）：<strong style={{ color: T.muted }}>{products.find(p => p.internalName === productName)?.productTitle}</strong>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>核心卖点 <span style={{ color: T.danger }}>*</span></div>
              <textarea value={sellingPoints} onChange={e => setSellingPoints(e.target.value)} rows={2} placeholder="eg. flattering cut, tummy control, wrinkle-free fabric…" style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px", fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>痛点解决 <span style={{ color: T.danger }}>*</span></div>
              <textarea value={painPoints} onChange={e => setPainPoints(e.target.value)} rows={2} placeholder="eg. solves the problem of finding flattering styles for curvy women…" style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px", fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>提供条件 <span style={{ color: T.danger }}>*</span> <span style={{ color: T.hint }}>(可多选)</span></div>
              <TagGroup options={OFFER_TYPES} selected={offers} onToggle={v => toggle(offers, setOffers, v)} color={T.accent} />
              {offers.includes("佣金合作") && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>佣金比例 (%)</div>
                  <Inp value={commissionPct} onChange={setCommissionPct} placeholder="eg. 10" style={{ width: 120 }} />
                </div>
              )}
              {offers.includes("固定费用") && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>固定费用 ($)</div>
                  <Inp value={fixedFee} onChange={setFixedFee} placeholder="eg. 200" style={{ width: 120 }} />
                </div>
              )}
            </div>
          </Card>

          {/* ── 板块三：生成设置 ── */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${T.success}22`, color: T.success }}>板块三</span>
              生成设置
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 8, fontWeight: 600 }}>开发信策略</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button onClick={() => setMsgStyle("efficiency")} style={{
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  border: `2px solid ${msgStyle === "efficiency" ? T.accent : T.border}`,
                  background: msgStyle === "efficiency" ? `${T.accent}10` : "#FEF6FA",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: msgStyle === "efficiency" ? T.accent : T.text, marginBottom: 4 }}>⚡ 效率型</div>
                  <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>条件先行，数字开场<br />适合大批量建联 / 免费寄样</div>
                </button>
                <button onClick={() => setMsgStyle("quality")} style={{
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  border: `2px solid ${msgStyle === "quality" ? T.a : T.border}`,
                  background: msgStyle === "quality" ? `${T.a}10` : "#FEF6FA",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: msgStyle === "quality" ? T.a : T.text, marginBottom: 4 }}>✨ 质感型</div>
                  <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>内容观察开场，真实感强<br />适合精选优质达人 / 付费合作</div>
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>发送渠道</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {CHANNELS.map(c => (
                  <button key={c} onClick={() => setChannel(c)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: `1px solid ${channel === c ? T.info : T.border}`, background: channel === c ? `${T.info}22` : "transparent", color: channel === c ? T.info : T.muted, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
                ))}
              </div>
              {channel && <div style={{ fontSize: 10, color: T.hint, marginTop: 5 }}>💡 {CHANNEL_HINTS[channel]}</div>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>形式</div>
              <div style={{ display: "flex", gap: 5 }}>
                {FORMATS.map(f => (
                  <button key={f} onClick={() => setFormat(f)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: `1px solid ${format === f ? T.a : T.border}`, background: format === f ? `${T.a}22` : "transparent", color: format === f ? T.a : T.muted, cursor: "pointer", fontFamily: "inherit" }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>语气</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {TONES.map(t => (
                  <button key={t} onClick={() => setTone(t)} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, border: `1px solid ${tone === t ? T.success : T.border}`, background: tone === t ? `${T.success}22` : "transparent", color: tone === t ? T.success : T.muted, cursor: "pointer", fontFamily: "inherit" }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>其它特殊要求 <span style={{ color: T.hint }}>(选填)</span></div>
              <textarea value={extraReq} onChange={e => setExtraReq(e.target.value)} rows={2} placeholder="eg. 提到她最近某个视频、强调限量、希望她本周内回复…" style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px", fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }} />
            </div>
          </Card>

          <Btn onClick={genMessage} accent disabled={loading || (!uid.trim() && !productName.trim())} style={{ width: "100%", marginBottom: 16 }}>
            {loading ? "生成中…" : "生成开发信"}
          </Btn>

          {/* ── 输出结果 ── */}
          {msg && (
            <div>
              <Card style={{ borderColor: `${T.accent}44` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: T.accent, fontWeight: 700 }}>生成结果</span>
                  <span style={{ fontSize: 11, color: T.hint, marginLeft: "auto" }}>Claude claude-sonnet-4-20250514</span>
                </div>

                {channel === "Email" && msg.startsWith("SUBJECT:") && (() => {
                  const lines = msg.split("\n");
                  const subjectLine = lines[0].replace("SUBJECT:", "").trim();
                  const body = lines.slice(1).join("\n").trim();
                  return (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>邮件标题</div>
                        <div style={{ background: `${T.accent}12`, border: `1.5px solid ${T.accent}44`, borderRadius: 8, padding: "10px 14px", fontSize: 15, fontWeight: 700, color: T.accent, letterSpacing: "0.02em" }}>
                          {subjectLine}
                        </div>
                        <Btn small onClick={() => navigator.clipboard?.writeText(subjectLine)} style={{ marginTop: 6 }}>复制标题</Btn>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>邮件正文</div>
                        <div style={{ fontSize: 14, lineHeight: 1.9, color: T.text, whiteSpace: "pre-wrap" }}>{body}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn small onClick={() => navigator.clipboard?.writeText(body)}>复制正文</Btn>
                        <Btn small onClick={() => navigator.clipboard?.writeText(`Subject: ${subjectLine}\n\n${body}`)}>复制全部</Btn>
                        <Btn small onClick={saveRecord}>保存到历史</Btn>
                      </div>
                    </div>
                  );
                })()}

                {!(channel === "Email" && msg.startsWith("SUBJECT:")) && (
                  <div>
                    <div style={{ fontSize: 14, lineHeight: 1.9, color: T.text, whiteSpace: "pre-wrap", marginBottom: 12 }}>{msg}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn small onClick={() => navigator.clipboard?.writeText(msg)}>复制</Btn>
                      <Btn small onClick={saveRecord}>保存到历史</Btn>
                    </div>
                  </div>
                )}
              </Card>

              {/* ── 修改意见框 ── */}
              <Card style={{ borderColor: `${T.a}33` }}>
                <div style={{ fontSize: 11, color: T.a, marginBottom: 8 }}>对结果不满意？提出修改意见</div>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="eg. 语气太正式了，能更随意一点吗？希望第一句直接提到她的身材特点。开头不要用 Hi，改成 Hey…"
                  style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px", fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                />
                <Btn onClick={refineMessage} disabled={refining || !feedback.trim()} style={{ width: "100%", border: `1px solid ${T.a}`, color: T.a, background: `${T.a}12` }}>
                  {refining ? "修改中…" : "提交修改意见，重新生成"}
                </Btn>
              </Card>

              {/* ── 最终版 ── */}
              <Card style={{ borderColor: `${T.success}44` }}>
                <div style={{ fontSize: 13, color: T.success, fontWeight: 700, marginBottom: 4 }}>最终版</div>
                <div style={{ fontSize: 11, color: T.hint, marginBottom: 8 }}>填入你最终敲定要发的文本，保存即代表已发送，自动进入「多渠道建联达人管理」。</div>
                <textarea
                  value={finalText}
                  onChange={e => { setFinalText(e.target.value); setFinalSaved(false); }}
                  rows={4}
                  placeholder="把最终确定的文本粘贴 / 编辑在这里…"
                  style={{ width: "100%", background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 13px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Btn accent disabled={!finalText.trim() || !uid.trim()} onClick={() => {
                    const contact = {
                      id: Date.now(),
                      date: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-"),
                      influencerId: uid.trim(),
                      product: productName || "",
                      email: email.trim() || "/",
                      channel,
                      finalText: finalText.trim(),
                    };
                    onSaveContact(contact);
                    setFinalSaved(true);
                  }}>{finalSaved ? "✓ 已保存到建联管理" : "保存最终版"}</Btn>
                  <Btn small onClick={() => setFinalText(msg)}>用上方生成结果填入</Btn>
                </div>
              </Card>
            </div>
          )}

          {/* ── 历史记录 ── */}
          {outreach.length > 0 && (
            <div>
              <SectionLabel>历史记录（{outreach.length} 条）</SectionLabel>
              {outreach.map(r => (
                <Card key={r.id} style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{r.influencerId || "—"}</span>
                    {r.channel && <Badge label={r.channel} color={T.info} />}
                    {r.format && <Badge label={r.format} color={T.a} />}
                    <span style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>{r.date}</span>
                  </div>
                  {r.product && <div style={{ fontSize: 11, color: T.hint, marginBottom: 4 }}>产品：{r.product}</div>}
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 8 }}>{r.message?.slice(0, 120)}…</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn small onClick={() => { setMsg(r.message); }}>查看全文</Btn>
                    {confirmDel === r.id ? (
                      <>
                        <Btn small danger onClick={() => deleteRecord(r.id)}>确认删除</Btn>
                        <Btn small onClick={() => setConfirmDel(null)}>取消</Btn>
                      </>
                    ) : (
                      <Btn small danger onClick={() => setConfirmDel(r.id)}>删除</Btn>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ 多渠道建联达人管理 ══ */}
      {tab === "contacts" && (() => {
        const filtered = contacts.filter(c => {
          const inRange = (!exportStart || c.date >= exportStart) && (!exportEnd || c.date <= exportEnd);
          const chMatch = contactChannelFilter === "ALL" || c.channel === contactChannelFilter;
          return inRange && chMatch;
        });
        const channelsInUse = ["ALL", ...new Set(contacts.map(c => c.channel).filter(Boolean))];

        function exportContacts() {
          const headers = ["记录日期", "达人ID", "产品", "邮箱地址", "渠道", "最终文本"];
          const rows = filtered.map(c => [c.date, c.influencerId, c.product || "", c.email || "/", c.channel || "", (c.finalText || "").replace(/\n/g, " ").replace(/,/g, "，")]);
          const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
          const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const tag = exportStart || exportEnd ? `${exportStart || "起始"}_${exportEnd || "至今"}` : "全部";
          a.href = url; a.download = `建联记录_${tag}.csv`; a.click(); URL.revokeObjectURL(url);
        }

        return (
          <div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
              这里是所有已保存最终版的达人（保存即视为已发送）。按记录日期范围筛选后可批量导出，拿着表格去批量执行。
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {channelsInUse.map(ch => (
                <button key={ch} onClick={() => setContactChannelFilter(ch)} style={{
                  fontSize: 12, padding: "4px 12px", borderRadius: 20,
                  border: `1.5px solid ${contactChannelFilter === ch ? T.accent : T.border}`,
                  background: contactChannelFilter === ch ? `${T.accent}15` : "#FEF6FA",
                  color: contactChannelFilter === ch ? T.accent : T.muted, cursor: "pointer", fontFamily: "inherit",
                  fontWeight: contactChannelFilter === ch ? 700 : 500,
                }}>{ch === "ALL" ? `全部 (${contacts.length})` : `${ch} (${contacts.filter(c => c.channel === ch).length})`}</button>
              ))}
            </div>
            <Card style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 8 }}>按记录日期范围导出（东八区）</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} style={{ fontSize: 14, padding: "8px 10px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontFamily: "inherit", color: T.text, background: "#FEF6FA" }} />
                <span style={{ color: T.hint }}>至</span>
                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} style={{ fontSize: 14, padding: "8px 10px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontFamily: "inherit", color: T.text, background: "#FEF6FA" }} />
                <Btn accent onClick={exportContacts} disabled={!filtered.length} style={{ marginLeft: "auto" }}>导出 CSV（{filtered.length} 条）</Btn>
              </div>
              {(exportStart || exportEnd) && <div style={{ fontSize: 11, color: T.hint, marginTop: 8 }}>留空任一端表示不限。当前匹配 {filtered.length} 条。</div>}
            </Card>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: T.muted, padding: "50px 0", fontSize: 14 }}>暂无记录</div>
            ) : filtered.map(c => (
              <Card key={c.id} style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{c.influencerId}</span>
                  {c.channel && <Badge label={c.channel} color={T.info} />}
                  {c.product && <span style={{ fontSize: 12, color: T.muted }}>{c.product}</span>}
                  <span style={{ fontSize: 12, color: T.hint, marginLeft: "auto" }}>{c.date}</span>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 13, color: T.muted, flexWrap: "wrap" }}>
                  <span>邮箱：<span style={{ color: c.email && c.email !== "/" ? T.text : T.hint }}>{c.email || "/"}</span></span>
                </div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, background: "#FEF6FA", borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-wrap", marginBottom: 10 }}>{c.finalText}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn small onClick={() => navigator.clipboard?.writeText(c.finalText)}>复制文本</Btn>
                  {contactDel === c.id ? (
                    <>
                      <Btn small danger onClick={() => { onSaveContacts(contacts.filter(x => x.id !== c.id)); setContactDel(null); }}>确认删除</Btn>
                      <Btn small onClick={() => setContactDel(null)}>取消</Btn>
                    </>
                  ) : (
                    <Btn small danger onClick={() => setContactDel(c.id)}>删除</Btn>
                  )}
                </div>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* ══ ROI 计算 ══ */}
      {tab === "roi" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>产品名称</div>
            <Inp value={roiProduct} onChange={setRoiProduct} placeholder="输入产品名称" />
          </div>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${T.info}22`, color: T.info }}>板块一</span>产品售价
            </div>
            <div><div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>售价 ($)</div><Inp value={salePrice} onChange={setSalePrice} placeholder="0.00" /></div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${T.warning}22`, color: T.warning }}>板块二</span>单件产品固定成本项
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[["产品物料成本 ($)", materialCost, setMaterialCost], ["头程费用 ($)", freightIn, setFreightIn], ["尾程费用 ($)", freightOut, setFreightOut]].map(([l, v, s]) => (
                <div key={l}><div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>{l}</div><Inp value={v} onChange={s} placeholder="0.00" /></div>
              ))}
              <div style={{ background: T.surface, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>产品固定成本小计</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>${(mc + fi + fo).toFixed(2)}</div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>各方抽佣比例（按售价计算）</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["平台抽佣比例 (%)", platformRate, setPlatformRate], ["公司抽佣比例 (%)", companyRate, setCompanyRate], ["广告抽佣比例 (%)", adRate, setAdRate], ["该达人佣金比例 (%)", influencerRate, setInfluencerRate]].map(([l, v, s]) => (
                  <div key={l}><div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>{l}</div><Inp value={v} onChange={s} placeholder="0" /></div>
                ))}
              </div>
              {sp > 0 && (pr + cr + ar + ir) > 0 && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: T.surface, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>抽佣合计</div>
                  <div style={{ fontSize: 14, color: T.text }}>${(sp * (pr + cr + ar + ir)).toFixed(2)} <span style={{ fontSize: 11, color: T.hint }}>({((pr + cr + ar + ir) * 100).toFixed(1)}% × ${sp})</span></div>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${T.danger}22`, color: T.danger }}>板块三</span>坑位费
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>坑位费 ($)</div><Inp value={pitFee} onChange={setPitFee} placeholder="0.00" /></div>
              <div style={{ background: T.surface, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>坑位费总成本</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>${(pit + fixedCost).toFixed(2)}</div>
                <div style={{ fontSize: 10, color: T.hint, marginTop: 2 }}>坑位费 + 物料 + 头程 + 尾程</div>
              </div>
            </div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>单件产品净利润</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: netProfit > 0 ? T.success : netProfit < 0 ? T.danger : T.muted }}>{sp > 0 ? `$${netProfit.toFixed(2)}` : "—"}</div>
              {sp > 0 && <div style={{ fontSize: 10, color: T.hint, marginTop: 4, lineHeight: 1.6 }}>${sp} − ${mc} − ${fi} − ${fo} − ${(sp * (pr + cr + ar + ir)).toFixed(2)}(抽佣合计)</div>}
            </div>
            <div style={{ background: T.card, border: `1px solid ${breakEven ? T.accent + "55" : T.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>该达人保本单量</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: breakEven ? T.accent : T.muted }}>{breakEven ? `${breakEven} 单` : netProfit <= 0 && sp > 0 ? "无法回本" : "—"}</div>
              {breakEven && <div style={{ fontSize: 10, color: T.hint, marginTop: 4, lineHeight: 1.6 }}>(坑位费 ${pit} + 固定成本 ${fixedCost.toFixed(2)}) ÷ 净利润 ${netProfit.toFixed(2)}</div>}
              {netProfit <= 0 && sp > 0 && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>单件利润为负，无法回本</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
