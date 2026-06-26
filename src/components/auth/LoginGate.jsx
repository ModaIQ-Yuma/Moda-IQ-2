import { useState } from "react";
import { sb } from "../../lib/supabase.js";

export default function LoginGate() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !pwd) { setMsg("请填写邮箱和密码"); return; }
    setBusy(true); setMsg("");
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pwd });
        if (error) setMsg("登录失败：" + (error.message.includes("Invalid") ? "邮箱或密码错误" : error.message));
      } else {
        const { error } = await sb.auth.signUp({ email: email.trim(), password: pwd });
        if (error) setMsg("注册失败：" + error.message);
        else setMsg("注册成功！如果提示需要邮箱验证，请查收邮件后再登录；否则可直接登录。");
      }
    } catch (e) { setMsg("出错了，请重试"); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 20% 10%, #FFEAF2 0%, transparent 50%), radial-gradient(circle at 85% 20%, #FFF0E8 0%, transparent 45%), #FDF7F9", fontFamily: "-apple-system, 'PingFang SC', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 40px rgba(232,75,124,0.14)", border: "1.5px solid #F0DCE4" }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "0.04em", background: "linear-gradient(135deg, #E84B7C 0%, #C73862 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textAlign: "center", marginBottom: 6 }}>Moda.IQ</div>
        <div style={{ fontSize: 13, color: "#B89AA6", textAlign: "center", marginBottom: 28 }}>TikTok 美区女装 BD 管理系统</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "#FDEEF4", borderRadius: 12, padding: 4 }}>
          {[["login", "登录"], ["signup", "注册"]].map(([k, l]) => (
            <button key={k} onClick={() => { setMode(k); setMsg(""); }} style={{ flex: 1, fontSize: 14, padding: "8px", borderRadius: 9, border: "none", background: mode === k ? "#fff" : "transparent", color: mode === k ? "#E84B7C" : "#7A5C68", fontWeight: mode === k ? 700 : 500, cursor: "pointer", fontFamily: "inherit", boxShadow: mode === k ? "0 1px 4px rgba(232,75,124,0.15)" : "none" }}>{l}</button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#7A5C68", marginBottom: 5, fontWeight: 600 }}>邮箱</div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={{ width: "100%", boxSizing: "border-box", background: "#FEF8FB", border: "1.5px solid #F0DCE4", borderRadius: 10, fontSize: 15, padding: "11px 14px", fontFamily: "inherit", outline: "none", color: "#2A1A22" }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: "#7A5C68", marginBottom: 5, fontWeight: 600 }}>密码</div>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="至少 6 位" style={{ width: "100%", boxSizing: "border-box", background: "#FEF8FB", border: "1.5px solid #F0DCE4", borderRadius: 10, fontSize: 15, padding: "11px 14px", fontFamily: "inherit", outline: "none", color: "#2A1A22" }} />
        </div>

        <button onClick={submit} disabled={busy} style={{ width: "100%", background: busy ? "#EFE3E9" : "linear-gradient(135deg, #E84B7C 0%, #C73862 100%)", color: busy ? "#B89AA6" : "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, padding: "12px", cursor: busy ? "default" : "pointer", fontFamily: "inherit", boxShadow: busy ? "none" : "0 2px 12px rgba(232,75,124,0.3)" }}>
          {busy ? "处理中…" : mode === "login" ? "登录" : "注册账号"}
        </button>

        {msg && <div style={{ fontSize: 13, color: msg.includes("成功") ? "#0EA371" : "#E0455E", marginTop: 14, lineHeight: 1.6, textAlign: "center" }}>{msg}</div>}

        <div style={{ fontSize: 11, color: "#B89AA6", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          团队成员各自注册账号，数据全团队共享
        </div>
      </div>
    </div>
  );
}

// 维度渲染顺序：销售数据 → 垂直程度 → 内容表现 → 匹配度
const SCORE_DIM_ORDER = ["sales", "vertical", "content", "match"];

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2 (render order): SCORING
// ══════════════════════════════════════════════════════════════════════════════
