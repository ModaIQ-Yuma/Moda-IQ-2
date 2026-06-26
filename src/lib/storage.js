import { SK } from "../constants/config.js";

/** 从 localStorage 读取数据，失败返回空数组 */
export function loadLocal(key) {
  try { return JSON.parse(localStorage.getItem(SK[key])) || []; }
  catch { return []; }
}

/** 将数据写入 localStorage */
export function saveLocal(key, value) {
  try { localStorage.setItem(SK[key], JSON.stringify(value)); }
  catch { /* 存储满了也不崩 */ }
}
