import { T } from "./tokens.js";

export const GRADES = [
  { min: 90, label: "S",  color: T.s },
  { min: 80, label: "A+", color: T.aplus },
  { min: 70, label: "A",  color: T.a },
  { min: 55, label: "B",  color: T.b },
  { min: 0,  label: "C",  color: T.c },
];

export const getGrade = (s) => GRADES.find((g) => s >= g.min) || GRADES[4];

export const SCORE_DIMS = [
  {
    id: "match", label: "匹配度", weight: 0.20, tag: "主观", maxPts: 100,
    indicators: [
      { label: "身材", opts: [{ l: "完全不适配", v: 0 }, { l: "一般适配", v: 30 }, { l: "能完美展示卖点", v: 50 }] },
      { label: "风格", opts: [{ l: "与产品调性冲突", v: 0 }, { l: "风格大体一致", v: 30 }, { l: "完全驾驭产品", v: 50 }] },
    ],
  },
  {
    id: "vertical", label: "垂直程度", weight: 0.20, tag: "客观", maxPts: 100,
    indicators: [
      { label: "30天内容垂直度", opts: [{ l: "女装占比＜30%", v: 0 }, { l: "女装占比30–70%", v: 30 }, { l: "女装占比≥70%", v: 50 }] },
      { label: "30天转化垂直度", opts: [{ l: "无服装成交", v: 0 }, { l: "服装成交＜50%", v: 30 }, { l: "服装成交≥50%", v: 50 }] },
    ],
  },
  {
    id: "sales", label: "销售数据", weight: 0.30, tag: "客观", maxPts: 100,
    indicators: [
      { label: "历史销量",   opts: [{ l: "＜250单", v: 0 }, { l: "250–499单", v: 20 }, { l: "≥500单", v: 40 }] },
      { label: "女粉占比",   opts: [{ l: "＜50%", v: 0 }, { l: "50–70%", v: 10 }, { l: "≥70%", v: 20 }] },
      { label: "近30天均播", opts: [{ l: "＜500", v: 0 }, { l: "500–1000", v: 20 }, { l: "≥1000", v: 40 }] },
    ],
  },
  {
    id: "content", label: "内容表现", weight: 0.30, tag: "主观", maxPts: 100,
    indicators: [
      { label: "画质", opts: [{ l: "模糊、灯光差", v: 0 }, { l: "普通清晰，无构图意识", v: 30 }, { l: "高清，构图好", v: 50 }] },
      { label: "口播", opts: [{ l: "不口播", v: 0 }, { l: "有口播但较扁平", v: 30 }, { l: "自然、有场景感、有情绪感染力", v: 50 }] },
    ],
  },
];

// 维度渲染顺序
export const SCORE_DIM_ORDER = ["sales", "vertical", "content", "match"];

export function initSel() {
  const s = {};
  SCORE_DIMS.forEach(d => {
    s[d.id] = {};
    d.indicators.forEach((_, i) => { s[d.id][i] = null; });
  });
  return s;
}

export function calcScore(sel) {
  let weighted = 0, tw = 0;
  const ds = {};
  SCORE_DIMS.forEach(d => {
    const vals = Object.entries(sel[d.id] || {})
      .filter(([, v]) => v !== null)
      .map(([, v]) => v);
    if (!vals.length) return;
    const rawSum = vals.reduce((a, b) => a + b, 0);
    const dimScore100 = Math.round((rawSum / 100) * 100);
    weighted += dimScore100 * d.weight;
    tw += d.weight;
    ds[d.id] = { raw: rawSum, max: 100, score100: dimScore100 };
  });
  return tw
    ? { score: Math.round(weighted / tw), dimScores: ds, coverage: tw }
    : { score: null, dimScores: ds, coverage: 0 };
}
