import { useState, useEffect } from "react";

// ─── 常量 & 配置 ──────────────────────────────────────────────────────────────
import { T } from "./constants/tokens.js";
import { TABS } from "./constants/config.js";

// ─── 数据层 ───────────────────────────────────────────────────────────────────
import { sb, cloudLoad, cloudSave } from "./lib/supabase.js";

// ─── 功能模块 ─────────────────────────────────────────────────────────────────
import ProductModule       from "./modules/ProductModule.jsx";
import ScoreModule         from "./modules/ScoreModule.jsx";
import OutreachModule      from "./modules/OutreachModule.jsx";
import CRMModule           from "./modules/CRMModule.jsx";
import VideoCollectModule  from "./modules/VideoCollectModule.jsx";
import ViralAnalysisModule from "./modules/ViralAnalysisModule.jsx";
import TrackingModule      from "./modules/TrackingModule.jsx";
import DashboardModule     from "./modules/DashboardModule.jsx";

// ─── 认证 & 权限组件 ─────────────────────────────────────────────────────────
import LoginGate  from "./components/auth/LoginGate.jsx";
import InviteGate from "./components/auth/InviteGate.jsx";
import AdminPanel from "./components/auth/AdminPanel.jsx";

// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT — 只负责：认证、权限、数据加载、顶层路由
// 业务逻辑全部在各 Module 文件里，这里不处理任何业务
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── 认证状态 ─────────────────────────────────────────────────────────────
  const [session, setSession]         = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!sb) { setAuthChecked(true); return; }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // ── 店铺 & 权限状态 ───────────────────────────────────────────────────────
  const [storeRole,    setStoreRole]    = useState(null);
  const [allStores,    setAllStores]    = useState([]);
  const [storeChecked, setStoreChecked] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [isGuest,      setIsGuest]      = useState(false);
  const [showAdmin,    setShowAdmin]    = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  useEffect(() => {
    if (!session || !sb) return;
    (async () => {
      setStoreChecked(false);
      const userId = session.user.id;
      const { data: roles } = await sb
        .from("user_store_roles")
        .select("store_id, role")
        .eq("user_id", userId);

      if (!roles || roles.length === 0) {
        setStoreRole(null); setStoreChecked(true); return;
      }

      const storeIds = roles.map(r => r.store_id);
      const { data: stores } = await sb.from("stores").select("id, name").in("id", storeIds);
      const storeMap = {};
      (stores || []).forEach(s => { storeMap[s.id] = s.name; });

      const isAdmin = roles.some(r => r.role === "admin");
      if (isAdmin) {
        const storeList = roles.map(r => ({
          store_id: r.store_id,
          name: storeMap[r.store_id] || r.store_id,
          role: r.role,
        }));
        setAllStores(storeList);
        const saved = localStorage.getItem("moda_active_store");
        const defaultStore = storeList.find(s => s.store_id === saved) || storeList[0];
        setActiveStoreId(defaultStore.store_id);
        setStoreRole({ store_id: defaultStore.store_id, role: "admin", store_name: defaultStore.name });
      } else {
        const r = roles[0];
        setStoreRole({ store_id: r.store_id, role: "member", store_name: storeMap[r.store_id] || r.store_id });
        setActiveStoreId(r.store_id);
        setAllStores([]);
      }
      setStoreChecked(true);
    })();
  }, [session]);

  function switchStore(storeId) {
    const s = allStores.find(x => x.store_id === storeId);
    if (!s) return;
    localStorage.setItem("moda_active_store", storeId);
    setActiveStoreId(storeId);
    setStoreRole({ store_id: storeId, role: "admin", store_name: s.name });
    // 切换店铺时清空数据，触发重新加载
    setInfluencers([]); setProducts([]); setSnapshots([]);
    setOutreach([]);    setContacts([]);
    setDataLoaded(false);
  }

  // ── 数据状态 ─────────────────────────────────────────────────────────────
  const [tab,         setTab]         = useState("product");
  const [influencers, setInfluencers] = useState([]);
  const [products,    setProducts]    = useState([]);
  const [snapshots,   setSnapshots]   = useState([]);
  const [outreach,    setOutreach]    = useState([]);
  const [contacts,    setContacts]    = useState([]);
  const [syncing,     setSyncing]     = useState(false);
  const [dataLoaded,  setDataLoaded]  = useState(false);

  useEffect(() => {
    if (!activeStoreId || !sb || dataLoaded || isGuest) return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      const [inf, prod, snap, out, con] = await Promise.all([
        cloudLoad("influencers", activeStoreId),
        cloudLoad("products",    activeStoreId),
        cloudLoad("snapshots",   activeStoreId),
        cloudLoad("outreach",    activeStoreId),
        cloudLoad("contacts",    activeStoreId),
      ]);
      if (cancelled) return;
      if (inf  !== null) setInfluencers(inf);
      if (prod !== null) setProducts(prod);
      if (snap !== null) setSnapshots(snap);
      if (out  !== null) setOutreach(out);
      if (con  !== null) setContacts(con);
      setSyncing(false);
      setDataLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [activeStoreId, dataLoaded, isGuest]);

  // ── 数据保存（访客模式拦截）───────────────────────────────────────────────
  const guestBlock = () => setShowGuestModal(true);

  const saveInfluencers = (d) => { if (isGuest) { guestBlock(); return; } setInfluencers(d); cloudSave("influencers", d, activeStoreId); };
  const saveProducts    = (d) => { if (isGuest) { guestBlock(); return; } setProducts(d);    cloudSave("products",    d, activeStoreId); };
  const saveSnapshots   = (d) => { if (isGuest) { guestBlock(); return; } setSnapshots(d);   cloudSave("snapshots",   d, activeStoreId); };
  const saveOutreach    = (d) => { if (isGuest) { guestBlock(); return; } setOutreach(d);    cloudSave("outreach",    d, activeStoreId); };
  const saveContacts    = (d) => { if (isGuest) { guestBlock(); return; } setContacts(d);    cloudSave("contacts",    d, activeStoreId); };
  const saveContact     = (c) => {
    if (isGuest) { guestBlock(); return; }
    const d = [c, ...contacts];
    setContacts(d);
    cloudSave("contacts", d, activeStoreId);
  };

  // ── 加载状态页 ────────────────────────────────────────────────────────────
  if (!authChecked) return <LoadingScreen text="加载中…" />;
  if (sb && !session) return <LoginGate />;
  if (!storeChecked) return <LoadingScreen text="验证权限中…" />;
  if (!storeRole && !isGuest) {
    return (
      <InviteGate
        session={session}
        onBound={() => { setStoreChecked(false); setIsGuest(false); }}
        onSkip={() => setIsGuest(true)}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 15% 0%, #FFEAF2 0%, transparent 45%), radial-gradient(circle at 90% 10%, #FFF0E8 0%, transparent 40%), #FDF7F9",
      color: T.text,
      fontFamily: "-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontSize: 15,
    }}>

      {/* 水印 */}
      <Watermark />

      {/* 访客提示条 */}
      {isGuest && (
        <GuestBanner onEnterCode={() => { setIsGuest(false); setStoreRole(null); setStoreChecked(true); }} />
      )}

      {/* 访客编辑拦截弹窗 */}
      {showGuestModal && (
        <GuestModal
          onClose={() => setShowGuestModal(false)}
          onEnterCode={() => { setShowGuestModal(false); setIsGuest(false); setStoreRole(null); setStoreChecked(true); }}
        />
      )}

      {/* 顶部导航 */}
      <Header
        tab={tab}
        setTab={setTab}
        syncing={syncing}
        session={session}
        storeRole={storeRole}
        allStores={allStores}
        activeStoreId={activeStoreId}
        onSwitchStore={switchStore}
        onShowAdmin={() => setShowAdmin(true)}
      />

      {/* 主内容区 */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 18px 80px" }}>
        {tab === "product"       && <ProductModule       products={products}       onSave={saveProducts}     snapshots={snapshots} readonly={isGuest} />}
        {tab === "score"         && <ScoreModule         influencers={influencers} onSave={saveInfluencers}  products={products}   readonly={isGuest} />}
        {tab === "outreach"      && <OutreachModule      outreach={outreach}       onSave={saveOutreach}     products={products}   onSaveContact={saveContact} contacts={contacts} onSaveContacts={saveContacts} influencers={influencers} readonly={isGuest} />}
        {tab === "crm"           && <CRMModule           influencers={influencers} onSave={saveInfluencers}  products={products}   readonly={isGuest} />}
        {tab === "videocollect"  && <VideoCollectModule  influencers={influencers} onSave={saveInfluencers}  readonly={isGuest} />}
        {tab === "viralanalysis" && <ViralAnalysisModule influencers={influencers} products={products}       onSaveProducts={saveProducts} readonly={isGuest} />}
        {tab === "tracking"      && <TrackingModule      snapshots={snapshots}     onSave={saveSnapshots}    influencers={influencers} products={products} readonly={isGuest} />}
        {tab === "dashboard"     && <DashboardModule     influencers={influencers} products={products}       snapshots={snapshots} />}
      </div>

      {showAdmin && (
        <AdminPanel session={session} allStores={allStores} onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}

// ─── 局部子组件（小到不值得单独建文件）──────────────────────────────────────

function LoadingScreen({ text }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#FDF7F9",
      color: T.muted, fontFamily: "-apple-system, sans-serif",
    }}>
      {text}
    </div>
  );
}

function Watermark() {
  return (
    <div style={{
      position: "fixed", bottom: 32, right: 32, zIndex: 9999,
      pointerEvents: "none", userSelect: "none",
      background: "rgba(255,255,255,0.25)", backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.55)",
      borderRadius: 16, padding: "10px 20px",
      boxShadow: "0 4px 24px rgba(232,75,124,0.12)",
    }}>
      <span style={{
        fontSize: 18, fontWeight: 800, letterSpacing: "0.12em",
        background: "linear-gradient(135deg, rgba(232,75,124,0.6) 0%, rgba(157,91,210,0.5) 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
      }}>Moda.IQ</span>
    </div>
  );
}

function GuestBanner({ onEnterCode }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #FFF3CD, #FFEAA7)",
      borderBottom: "1px solid #F5DEB0",
      padding: "10px 22px", display: "flex", alignItems: "center", gap: 12, fontSize: 13,
    }}>
      <span>👀 访客模式：你正在浏览系统功能，编辑功能需要邀请码。</span>
      <button onClick={onEnterCode} style={{
        fontSize: 12, padding: "4px 14px", borderRadius: 16,
        border: "1.5px solid #E8923B", background: "#fff",
        color: "#E8923B", cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
      }}>输入邀请码</button>
    </div>
  );
}

function GuestModal({ onClose, onEnterCode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(42,26,34,0.5)",
      zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "36px 32px",
        maxWidth: 360, width: "100%",
        boxShadow: "0 20px 60px rgba(232,75,124,0.2)",
        border: "1.5px solid #F0DCE4", textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#2A1A22", marginBottom: 10 }}>需要邀请码</div>
        <div style={{ fontSize: 14, color: "#7A5C68", lineHeight: 1.7, marginBottom: 24 }}>
          编辑功能仅限绑定店铺的用户使用。<br />请联系管理员获取试用邀请码。
        </div>
        <button onClick={onEnterCode} style={{
          width: "100%", background: "linear-gradient(135deg, #E84B7C 0%, #C73862 100%)",
          color: "#fff", border: "none", borderRadius: 10,
          fontSize: 15, fontWeight: 700, padding: "12px",
          cursor: "pointer", fontFamily: "inherit", marginBottom: 10,
        }}>输入邀请码</button>
        <button onClick={onClose} style={{
          width: "100%", background: "transparent", color: "#B89AA6",
          border: "1.5px solid #F0DCE4", borderRadius: 10,
          fontSize: 14, padding: "10px", cursor: "pointer", fontFamily: "inherit",
        }}>继续浏览</button>
      </div>
    </div>
  );
}

function Header({ tab, setTab, syncing, session, storeRole, allStores, activeStoreId, onSwitchStore, onShowAdmin }) {
  return (
    <div style={{
      borderBottom: `1.5px solid ${T.border}`,
      padding: "0 22px", display: "flex", alignItems: "center", gap: 18,
      height: 60, overflowX: "auto",
      background: T.navGrad, boxShadow: "0 2px 16px rgba(232,75,124,0.07)",
      position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(8px)",
    }}>
      <span style={{
        fontSize: 19, fontWeight: 900, letterSpacing: "0.04em",
        background: T.grad, WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent", backgroundClip: "text", whiteSpace: "nowrap",
      }}>Moda.IQ</span>

      <div style={{ display: "flex", gap: 5 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            fontSize: 13, padding: "7px 15px", borderRadius: 20, border: "none",
            background: tab === t.id ? T.grad : "transparent",
            color: tab === t.id ? "#fff" : T.muted,
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            fontWeight: tab === t.id ? 700 : 600,
            boxShadow: tab === t.id ? "0 2px 10px rgba(232,75,124,0.3)" : "none",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {syncing && <span style={{ fontSize: 12, color: T.hint }}>☁ 同步中…</span>}

        {storeRole?.role === "admin" && allStores.length > 1 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#FFF0F5", border: `1.5px solid ${T.border}`,
            borderRadius: 20, padding: "4px 6px 4px 12px",
          }}>
            <span style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>🏪</span>
            <select
              value={activeStoreId}
              onChange={e => onSwitchStore(e.target.value)}
              style={{
                fontSize: 12, border: "none", background: "transparent",
                color: T.text, fontFamily: "inherit", cursor: "pointer",
                outline: "none", fontWeight: 600,
              }}
            >
              {allStores.map(s => (
                <option key={s.store_id} value={s.store_id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {storeRole?.role === "member" && (
          <span style={{
            fontSize: 12, color: T.muted, background: "#FFF0F5",
            border: `1px solid ${T.border}`, borderRadius: 16, padding: "4px 10px",
          }}>🏪 {storeRole.store_name}</span>
        )}

        {storeRole?.role === "admin" && (
          <button onClick={onShowAdmin} style={{
            fontSize: 12, padding: "5px 12px", borderRadius: 16,
            border: `1.5px solid ${T.accent}`, background: "transparent",
            color: T.accent, cursor: "pointer", fontFamily: "inherit",
            fontWeight: 700, whiteSpace: "nowrap",
          }}>⚙ 管理</button>
        )}

        {session?.user?.email && (
          <span style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>
            {session.user.email}
          </span>
        )}

        <button onClick={() => sb?.auth.signOut()} style={{
          fontSize: 12, padding: "5px 12px", borderRadius: 16,
          border: `1.5px solid ${T.border}`, background: "transparent",
          color: T.muted, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
        }}>退出</button>
      </div>
    </div>
  );
}
