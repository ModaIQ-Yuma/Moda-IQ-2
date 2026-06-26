import { useState } from "react";
import { sb } from "../../lib/supabase.js";
import { TRIAL_EXPIRE_DAYS } from "../../constants/config.js";

export default function InviteGate({ session, onBound, onSkip }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitCode() {
    if (!code.trim()) { setMsg("请输入邀请码"); return; }
    setBusy(true); setMsg("");
    try {
      const { data: invite, error } = await sb.from("invite_codes").select("id, store_id, used_by, expires_at").ilike("code", code.trim()).single();
      if (error || !invite) { setMsg("邀请码无效，即将以访客身份进入…"); setTimeout(() => onSkip(), 1500); setBusy(false); return; }

      // 检查是否过期（expires_at 为 null 表示永久有效）
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setMsg("邀请码已过期，即将以访客身份进入…"); setTimeout(() => onSkip(), 1500); setBusy(false); return;
      }

      // 绑定用户到店铺
      const { error: roleError } = await sb.from("user_store_roles").upsert({
        user_id: session.user.id, store_id: invite.store_id, role: "member",
      }, { onConflict: "user_id,store_id" });
      if (roleError) { setMsg("绑定失败，请重试"); setBusy(false); return; }

      // 试用码：首次使用时设置过期时间（3天后）
      if (!invite.expires_at && !invite.used_by) {
        // 永久码不设过期
      } else if (!invite.used_by) {
        // 试用码首次使用，设 3 天过期
        const exp = new Date(); exp.setDate(exp.getDate() + 3);
        await sb.from("invite_codes").update({ used_by: session.user.id, used_at: new Date().toISOString(), expires_at: exp.toISOString() }).eq("id", invite.id);
      }

      setMsg("绑定成功！正在进入系统…");
      setTimeout(() => onBound(), 1000);
    } catch (e) { setMsg("出错了，请重试"); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 20% 10%, #FFEAF2 0%, transparent 50%), radial-gradient(circle at 85% 20%, #FFF0E8 0%, transparent 45%), #FDF7F9", fontFamily: "-apple-system, 'PingFang SC', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 40px rgba(232,75,124,0.14)", border: "1.5px solid #F0DCE4" }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "0.04em", background: "linear-gradient(135deg, #E84B7C 0%, #C73862 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", textAlign: "center", marginBottom: 6 }}>Moda.IQ</div>
        <div style={{ fontSize: 13, color: "#B89AA6", textAlign: "center", marginBottom: 28 }}>请输入邀请码以进入系统</div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: "#7A5C68", marginBottom: 5, fontWeight: 600 }}>邀请码</div>
          <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && submitCode()} placeholder="请输入邀请码" style={{ width: "100%", boxSizing: "border-box", background: "#FEF8FB", border: "1.5px solid #F0DCE4", borderRadius: 10, fontSize: 15, padding: "11px 14px", fontFamily: "inherit", outline: "none", color: "#2A1A22" }} />
        </div>
        <button onClick={submitCode} disabled={busy} style={{ width: "100%", background: busy ? "#EFE3E9" : "linear-gradient(135deg, #E84B7C 0%, #C73862 100%)", color: busy ? "#B89AA6" : "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, padding: "12px", cursor: busy ? "default" : "pointer", fontFamily: "inherit", marginBottom: 10 }}>
          {busy ? "验证中…" : "进入系统"}
        </button>
        <button onClick={onSkip} style={{ width: "100%", background: "transparent", color: "#B89AA6", border: "1.5px solid #F0DCE4", borderRadius: 10, fontSize: 14, padding: "10px", cursor: "pointer", fontFamily: "inherit" }}>
          暂不绑定，以访客身份进入
        </button>
        {msg && <div style={{ fontSize: 13, color: msg.includes("成功") ? "#0EA371" : "#E8923B", marginTop: 14, lineHeight: 1.6, textAlign: "center" }}>{msg}</div>}
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button onClick={() => sb?.auth.signOut()} style={{ fontSize: 12, color: "#B89AA6", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>退出登录</button>
        </div>
      </div>
    </div>
  );
}

// ─── 管理面板（弹窗）─────────────────────────────────────────────────────────
