// ─── 通用工具函数 ─────────────────────────────────────────────────────────────

/** 统一字符串格式：小写 + 去空格 + 去括号，用于模糊匹配 */
export function normalize(str) {
  return (str || "").toLowerCase().replace(/\s+/g, "").replace(/[（(）)]/g, "");
}

/**
 * 判断两个产品名是否模糊匹配
 * 任意一方包含另一方即为匹配
 */
export function matchProduct(a, b) {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** 解析 CSV 行（处理带引号的字段） */
export function parseCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

/** 获取今天的东八区日期字符串 YYYY-MM-DD */
export function todayCST() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

/** 解析各种格式的日期字符串为 YYYY-MM-DD，失败返回 null */
export function parseDate(str) {
  if (!str) return null;
  const s = str.trim().replace(/\//g, "-");
  const parts = s.split("-");
  if (parts.length === 3 && parts[0].length === 2) parts[0] = "20" + parts[0];
  const normed = parts.map((p, i) => i === 0 ? p : p.padStart(2, "0")).join("-");
  const d = new Date(normed);
  return isNaN(d.getTime()) ? null : normed;
}

/** 判断日期字符串是否在 [start, end) 区间内 */
export function inPeriod(dateStr, start, end) {
  const d = parseDate(dateStr);
  return d ? d >= start && d < end : false;
}

/**
 * 根据统计月份字符串（YYYY-MM）计算寄样周期
 * 规则：上月15日（含）～ 本月15日（不含）
 */
export function getPeriodBounds(monthStr) {
  if (!monthStr) return { start: null, end: null, label: "" };
  const [y, m] = monthStr.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const start = `${py}-${String(pm).padStart(2, "0")}-15`;
  const end   = `${y}-${String(m).padStart(2, "0")}-15`;
  return { start, end, label: `${py}年${pm}月15日 ～ ${y}年${m}月14日` };
}
