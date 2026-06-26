import { T } from "../../constants/tokens.js";

// ─── 基础 UI 组件库 ───────────────────────────────────────────────────────────
// 所有组件都从这里导出，使用方 import { Btn, Card, ... } from "../components/ui"

export function Inp({ value, onChange, placeholder, style = {} }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", background: "#FEF8FB",
        border: `1.5px solid ${T.border}`, borderRadius: 10,
        color: T.text, fontSize: 15, padding: "10px 14px",
        fontFamily: "inherit", outline: "none",
        boxSizing: "border-box", transition: "border-color 0.15s",
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = T.accent}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  );
}

export function Sel({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: "#FEF8FB", border: `1.5px solid ${T.border}`,
        borderRadius: 10, color: T.text, fontSize: 15,
        padding: "10px 14px", fontFamily: "inherit",
        outline: "none", cursor: "pointer", ...style,
      }}
    >
      {children}
    </select>
  );
}

export function Btn({ onClick, children, accent, danger, small, disabled, style = {} }) {
  const bg  = accent ? T.grad : "transparent";
  const col = accent ? "#FFFFFF" : danger ? T.danger : T.muted;
  const bdr = accent ? "none" : danger ? `1.5px solid ${T.danger}` : `1.5px solid ${T.border}`;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#EFE3E9" : bg,
        color: disabled ? T.hint : col,
        border: bdr, borderRadius: 10,
        fontSize: small ? 13 : 15,
        padding: small ? "6px 14px" : "10px 22px",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit", fontWeight: accent ? 700 : 600,
        opacity: disabled ? 0.6 : 1,
        boxShadow: accent && !disabled ? "0 2px 10px rgba(232,75,124,0.28)" : "none",
        transition: "transform 0.1s, box-shadow 0.15s", ...style,
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {children}
    </button>
  );
}

export function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 12, padding: "3px 10px", borderRadius: 20,
      background: `${color}15`, color,
      border: `1px solid ${color}44`, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

export function MetricCard({ label, value, sub }) {
  return (
    <div style={{
      background: T.gradSoft, borderRadius: 12,
      padding: "13px 16px", border: `1px solid ${T.border}`,
    }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 12, color: T.hint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, color: T.accent,
      letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: 10, marginTop: 22,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ width: 14, height: 2, background: T.grad, borderRadius: 2, display: "inline-block" }} />
      {children}
    </div>
  );
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.card, border: `1.5px solid ${T.border}`,
      borderRadius: 16, padding: "18px 20px", marginBottom: 14,
      boxShadow: "0 2px 12px rgba(232,75,124,0.06)", ...style,
    }}>
      {children}
    </div>
  );
}

/** 多选标签组件（开发信模块用） */
export function TagGroup({ options, selected, onToggle, color }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            style={{
              fontSize: 13, padding: "5px 13px", borderRadius: 20,
              border: `1.5px solid ${on ? color : T.border}`,
              background: on ? `${color}18` : "#FEF6FA",
              color: on ? color : T.muted,
              cursor: "pointer", fontFamily: "inherit",
              fontWeight: on ? 700 : 500,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
