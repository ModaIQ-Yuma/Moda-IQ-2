// ─── 全局配置常量（魔法数字/字符串统一在这里管理）────────────────────────────

// AI 模型
export const AI_MODEL = "claude-sonnet-4-20250514";
export const AI_MAX_TOKENS = 1000;
export const AI_MAX_TOKENS_VIRAL = 1500;

// 业务规则
export const REPOST_THRESHOLD_ORDERS = 3;   // 累计出单≥这个数触发「待复投」
export const TRIAL_EXPIRE_DAYS = 3;          // 试用码有效天数

// localStorage keys（版本号放这里，升级时只改一处）
export const SK = {
  influencers:   "tkbd_influencers_v1",
  products:      "tkbd_products_v1",
  snapshots:     "tkbd_snapshots_v1",
  outreach:      "tkbd_outreach_v1",
  contacts:      "tkbd_contacts_v1",
  viralHistory:  "tkbd_viral_v1",
  unmatchedVideos: "tkbd_unmatched_videos_v1",
};

// Supabase 表名
export const TABLES = {
  influencers:   "influencers",
  products:      "products",
  snapshots:     "snapshots",
  outreach:      "outreach",
  contacts:      "contacts",
};

// 导航 Tab
export const TABS = [
  { id: "product",       label: "① 产品管理" },
  { id: "score",         label: "② 达人评级" },
  { id: "outreach",      label: "③ 开发信 & 回本" },
  { id: "crm",           label: "④ CRM 管理" },
  { id: "videocollect",  label: "⑤ 视频回收" },
  { id: "viralanalysis", label: "⑥ 爆款分析" },
  { id: "tracking",      label: "⑦ 月度追踪" },
  { id: "dashboard",     label: "⑧ 数据看板" },
];
