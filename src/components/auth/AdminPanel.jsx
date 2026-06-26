import { useState, useEffect } from "react";
import { sb } from "../../lib/supabase.js";

export default function AdminPanel({ session, allStores, onClose }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [newStoreId, setNewStoreId] = useState(allStores[0]?.store_id || "");
  const [isTrial, setIsTrial] = useState(false); // 是否是试用码
  const [msg, setMsg] = useState("");

  useEffect(() => { loadCodes(); }, []);

  async function loadCodes() {
    setLoading(true);
    const { data } = await sb.from("invite_codes").select("id, code, store_id, used_by, used_at, expires_at, created_at").order("created_at", { ascending: false });
    setCodes(data || []);
    setLoading(false);
  }

  async function createCode() {
    if (!newCode.trim()) { setMsg("请输入邀请码内容"); return; }
    if (!newStoreId) { setMsg("请选择店铺"); return; }
    const row = { code: newCode.trim(), store_id: newStoreId };
    // 试用码：创建时就设好 3 天后过期；永久码：expires_at 留空
    if (isTrial) { const exp = new Date(); exp.setDate(exp.getDate() + 3); row.expires_at = exp.toISOString(); }
    const { error } = await sb.from("invite_codes").insert(row);
    if (error) { setMsg("创建失败：" + error.message); return; }
    setMsg("创建成功！"); setNewCode("");
    loadCodes();
  }

  async function deleteCode(id) {
    await sb.from("invite_codes").delete().eq("id", id);
    loadCodes();
  }

  const storeName = (storeId) => allStores.find(s => s.store_id === storeId)?.name || storeId;

  const isExpired = (code) => code.expires_at && new Date(code.expires_at) < new Date();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(42,26,34,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(232,75,124,0.2)", border: "1.5px solid #F0DCE4" }}>
        <div style={{ padding: "24px 28px", borderBottom: "1.5px solid #F0DCE4", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 800, flex: 1, color: "#2A1A22" }}>⚙ 邀请码管理</span>
          <button onClick={onClose} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#B89AA6", lineHeight: 1 }}>×</button>
        </div>

        {/* 创建新邀请码 */}
        <div style={{ padding: "20px 28px", borderBottom: "1.5px solid #F0DCE4", background: "#FFF8FB" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E84B7C", marginBottom: 14, letterSpacing: "0.05em" }}>创建新邀请码</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#7A5C68", marginBottom: 4, fontWeight: 600 }}>邀请码内容</div>
              <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="例如：TRIAL2024" style={{ width: "100%", boxSizing: "border-box", background: "#FEF8FB", border: "1.5px solid #F0DCE4", borderRadius: 8, fontSize: 14, padding: "9px 12px", fontFamily: "inherit", outline: "none", color: "#2A1A22" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#7A5C68", marginBottom: 4, fontWeight: 600 }}>对应店铺</div>
              <select value={newStoreId} onChange={e => setNewStoreId(e.target.value)} style={{ width: "100%", background: "#FEF8FB", border: "1.5px solid #F0DCE4", borderRadius: 8, fontSize: 14, padding: "9px 12px", fontFamily: "inherit", outline: "none", color: "#2A1A22" }}>
                {allStores.map(s => <option key={s.store_id} value={s.store_id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "#7A5C68" }}>
              <input type="checkbox" checked={isTrial} onChange={e => setIsTrial(e.target.checked)} />
              试用码（用户首次使用后 3 天过期）
            </label>
          </div>
          <button onClick={createCode} style={{ background: "linear-gradient(135deg, #E84B7C 0%, #C73862 100%)", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, padding: "9px 24px", cursor: "pointer", fontFamily: "inherit" }}>创建</button>
          {msg && <span style={{ fontSize: 13, color: msg.includes("成功") ? "#0EA371" : "#E0455E", marginLeft: 12 }}>{msg}</span>}
        </div>

        {/* 现有邀请码列表 */}
        <div style={{ padding: "20px 28px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7A5C68", marginBottom: 14 }}>现有邀请码（{codes.length} 个）</div>
          {loading ? <div style={{ color: "#B89AA6", fontSize: 13 }}>加载中…</div> : codes.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #F0DCE4", marginBottom: 8, background: isExpired(c) ? "#FFF5F5" : "#FDFEFF", opacity: isExpired(c) ? 0.7 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#2A1A22", letterSpacing: "0.04em" }}>{c.code}</span>
                  <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 20, background: isExpired(c) ? "#FFE5E5" : c.expires_at ? "#FFF3CD" : "#E8F8F0", color: isExpired(c) ? "#E0455E" : c.expires_at ? "#E8923B" : "#0EA371", fontWeight: 600 }}>
                    {isExpired(c) ? "已过期" : c.expires_at ? `${Math.ceil((new Date(c.expires_at) - new Date()) / 86400000)} 天后过期` : "永久有效"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#B89AA6" }}>
                  店铺：{storeName(c.store_id)}
                  {c.used_at && ` · 首次使用：${new Date(c.used_at).toLocaleDateString("zh-CN")}`}
                </div>
              </div>
              <button onClick={() => deleteCode(c.id)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1.5px solid #F5C0C0", background: "#fff", color: "#E0455E", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>删除</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

