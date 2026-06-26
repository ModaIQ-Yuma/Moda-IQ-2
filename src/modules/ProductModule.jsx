import { useState } from "react";
import { T } from "../constants/tokens.js";
import { PRODUCT_STATUSES, PS_COLORS } from "../constants/crm.js";
import { Btn, Card, Badge, MetricCard } from "../components/ui/index.jsx";
import { Inp, Sel } from "../components/ui/index.jsx";

export default function ProductModule({ products, onSave, snapshots }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [internalName, setInternalName] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [status, setStatus] = useState("测款");
  const [expanded, setExpanded] = useState(null);

  function openNew() {
    setEditId(null); setInternalName(""); setProductTitle("");
    setKeyPoints(""); setStatus("测款"); setShowForm(true);
  }
  function openEdit(p) {
    setEditId(p.id);
    setInternalName(p.internalName || "");
    setProductTitle(p.productTitle || p.name || "");
    setKeyPoints(p.keyPoints || "");
    setStatus(p.status || "测款");
    setShowForm(true);
  }
  function saveProduct() {
    if (!internalName.trim()) return;
    const prod = {
      id: editId || Date.now(),
      internalName: internalName.trim(),
      productTitle: productTitle.trim(),
      name: internalName.trim(),
      sku: internalName.trim(),
      keyPoints: keyPoints.trim(),
      status,
      createdAt: new Date().toLocaleDateString("zh-CN"),
    };
    onSave(editId
      ? products.map(p => p.id === editId ? { ...p, ...prod } : p)
      : [prod, ...products]
    );
    setShowForm(false);
  }
  function updateStatus(id, st) {
    onSave(products.map(p => p.id === id ? { ...p, status: st } : p));
  }
  function deleteProduct(id) {
    onSave(products.filter(p => p.id !== id));
  }

  const statusCounts = {};
  PRODUCT_STATUSES.forEach(s => {
    statusCounts[s] = products.filter(p => p.status === s).length;
  });

  return (
    <div>
      {/* 顶部统计 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1, marginRight: 12 }}>
          {PRODUCT_STATUSES.map(s => (
            <div key={s} style={{
              background: "#FFFFFF", border: `1.5px solid ${PS_COLORS[s]}44`,
              borderRadius: 10, padding: "10px 16px", minWidth: 80, textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}>
              <div style={{ fontSize: 11, color: PS_COLORS[s], fontWeight: 700, marginBottom: 4 }}>{s}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{statusCounts[s] || 0}</div>
            </div>
          ))}
        </div>
        <Btn onClick={openNew} accent>+ 新增产品</Btn>
      </div>

      {/* 新增 / 编辑表单 */}
      {showForm && (
        <Card style={{ borderColor: `${T.accent}55`, marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: T.text }}>
            {editId ? "编辑产品档案" : "新增产品档案"}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
            板块一 · 产品基础档案
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 6, fontWeight: 600 }}>
                产品内部名称 <span style={{ color: T.danger }}>*</span>
              </div>
              <Inp value={internalName} onChange={setInternalName} placeholder="eg. WD-001 / 黑色小礼服" />
              <div style={{ fontSize: 12, color: T.hint, marginTop: 4 }}>内部沟通用编号，系统将以此称呼该产品</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 6, fontWeight: 600 }}>产品商品名</div>
              <Inp value={productTitle} onChange={setProductTitle} placeholder="eg. Floral Wrap Midi Dress" />
              <div style={{ fontSize: 12, color: T.hint, marginTop: 4 }}>售卖页面名称，开发信和分析时参考</div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 6, fontWeight: 600 }}>核心卖点</div>
            <textarea
              value={keyPoints}
              onChange={e => setKeyPoints(e.target.value)}
              rows={2}
              placeholder="eg. 显瘦·V领·遮肚子·免烫·适合度假·多场景穿搭"
              style={{
                width: "100%", background: "#FEF6FA", border: `1.5px solid ${T.border}`,
                borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 13px",
                fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
            板块二 · 推广状态
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {PRODUCT_STATUSES.map(s => (
              <button key={s} onClick={() => setStatus(s)} style={{
                fontSize: 13, padding: "6px 16px", borderRadius: 20,
                border: `1.5px solid ${status === s ? PS_COLORS[s] : T.border}`,
                background: status === s ? `${PS_COLORS[s]}15` : "#FEF6FA",
                color: status === s ? PS_COLORS[s] : T.muted,
                cursor: "pointer", fontFamily: "inherit", fontWeight: status === s ? 700 : 500,
              }}>{s}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={saveProduct} accent disabled={!internalName.trim()} style={{ flex: 1 }}>保存</Btn>
            <Btn onClick={() => setShowForm(false)}>取消</Btn>
          </div>
        </Card>
      )}

      {/* 产品列表 */}
      {products.length === 0
        ? <div style={{ textAlign: "center", color: T.muted, padding: "60px 0", fontSize: 15 }}>
            暂无产品，点击「新增产品」开始
          </div>
        : products.map(prod => {
          const prodSnaps = snapshots
            .filter(s => s.sku === prod.internalName || s.sku === prod.sku)
            .sort((a, b) => b.month.localeCompare(a.month));
          const latest = prodSnaps[0];
          const isExp = expanded === prod.id;

          return (
            <Card key={prod.id}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onClick={() => setExpanded(isExp ? null : prod.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{prod.internalName}</div>
                  {prod.productTitle && (
                    <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{prod.productTitle}</div>
                  )}
                </div>
                <Badge label={prod.status} color={PS_COLORS[prod.status] || T.muted} />
                <span style={{ fontSize: 13, color: T.hint }}>{isExp ? "▲" : "▼"}</span>
              </div>

              {isExp && (
                <div style={{ borderTop: `1.5px solid ${T.border}`, marginTop: 14, paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                    产品基础档案
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {[["内部名称", prod.internalName], ["商品名", prod.productTitle || "—"]].map(([l, v]) => (
                      <div key={l} style={{ background: "#FDEEF4", borderRadius: 8, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, color: T.muted, marginBottom: 4, fontWeight: 600 }}>{l}</div>
                        <div style={{ fontSize: l === "内部名称" ? 15 : 14, fontWeight: l === "内部名称" ? 700 : 400, color: T.text }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {prod.keyPoints && (
                    <div style={{ background: "#FDEEF4", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600 }}>核心卖点</div>
                      <div style={{ fontSize: 14, color: T.text, lineHeight: 1.7 }}>{prod.keyPoints}</div>
                    </div>
                  )}

                  {(prod.creatorProfile || prod.viralKeywords) && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                        来自爆款分析
                        <span style={{ fontSize: 10, fontWeight: 400, color: T.hint, textTransform: "none" }}>（由⑥爆款分析模块自动更新）</span>
                      </div>
                      {prod.creatorProfile && (
                        <div style={{ background: `${T.a}0D`, border: `1.5px solid ${T.a}33`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                          <div style={{ fontSize: 12, color: T.a, marginBottom: 6, fontWeight: 700 }}>推荐达人画像</div>
                          <div style={{ fontSize: 14, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{prod.creatorProfile}</div>
                        </div>
                      )}
                      {prod.viralKeywords && (
                        <div style={{ background: `${T.success}0D`, border: `1.5px solid ${T.success}33`, borderRadius: 8, padding: "12px 14px" }}>
                          <div style={{ fontSize: 12, color: T.success, marginBottom: 8, fontWeight: 700 }}>病毒性关键词</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {prod.viralKeywords.split(/[，,、\n]/).filter(k => k.trim()).map((kw, i) => (
                              <span key={i} style={{
                                fontSize: 13, padding: "4px 12px", borderRadius: 20,
                                background: `${T.success}15`, color: T.success,
                                fontWeight: 600, border: `1px solid ${T.success}44`,
                              }}>{kw.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                    推广状态
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
                    {PRODUCT_STATUSES.map(s => (
                      <button key={s} onClick={() => updateStatus(prod.id, s)} style={{
                        fontSize: 13, padding: "5px 14px", borderRadius: 20,
                        border: `1.5px solid ${prod.status === s ? PS_COLORS[s] : T.border}`,
                        background: prod.status === s ? `${PS_COLORS[s]}15` : "#FEF6FA",
                        color: prod.status === s ? PS_COLORS[s] : T.muted,
                        cursor: "pointer", fontFamily: "inherit", fontWeight: prod.status === s ? 700 : 500,
                      }}>{s}</button>
                    ))}
                  </div>

                  {latest && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 8 }}>
                        最新月度快照 {latest.month}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                        <MetricCard label="样销比" value={latest.sampling?.sampleSalesRatio ? `1:${latest.sampling.sampleSalesRatio}` : "—"} />
                        <MetricCard label="CTR" value={latest.video?.ctr ? `${latest.video.ctr}%` : "—"} />
                        <MetricCard label="CVR" value={latest.video?.cvr ? `${latest.video.cvr}%` : "—"} />
                        <MetricCard label="总成交" value={latest.video?.totalOrders || "—"} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <Btn small onClick={() => openEdit(prod)}>编辑档案</Btn>
                    <Btn small danger onClick={() => deleteProduct(prod.id)}>删除产品</Btn>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
    </div>
  );
}
