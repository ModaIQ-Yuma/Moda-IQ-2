// ─── Supabase 客户端与云端 CRUD ───────────────────────────────────────────────
// Supabase 客户端通过 index.html CDN 全局加载（window.supabase）

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = typeof window !== "undefined" && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ─── 云端读取（按 store_id 过滤，自动分页突破 1000 条限制）──────────────────
export async function cloudLoad(table, storeId) {
  if (!sb || !storeId) return null;
  try {
    const PAGE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from(table)
        .select("id, data")
        .eq("store_id", storeId)
        .order("id", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) { console.error("cloudLoad error", table, error); return null; }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break; // 最后一页，退出
      from += PAGE;
    }
    return all.map(row => row.data);
  } catch (e) {
    console.error("cloudLoad exception", e);
    return null;
  }
}

// ─── 云端保存（upsert，修复了原来 DELETE+INSERT 无事务的数据丢失风险）──────────
export async function cloudSave(table, arr, storeId) {
  if (!sb || !storeId) return false;
  try {
    if (!arr || arr.length === 0) {
      // 数组为空时才执行删除（清空该表）
      const { error } = await sb.from(table).delete().eq("store_id", storeId);
      if (error) { console.error("cloudSave delete error", table, error); return false; }
      return true;
    }

    // 用 upsert 代替 DELETE+INSERT，避免网络抖动时数据丢失
    const rows = arr.map(item => ({
      id: item.id || Date.now() + Math.floor(Math.random() * 100000),
      data: item,
      store_id: storeId,
    }));

    const { error: upsertError } = await sb
      .from(table)
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      console.error("cloudSave upsert error", table, upsertError);
      return false;
    }

    // 删除不在当前数组里的旧记录（软同步）
    const currentIds = rows.map(r => r.id);
    const { error: deleteError } = await sb
      .from(table)
      .delete()
      .eq("store_id", storeId)
      .not("id", "in", `(${currentIds.join(",")})`);

    if (deleteError) {
      // 删除旧记录失败不影响主数据，只记录日志
      console.warn("cloudSave cleanup error (non-fatal)", table, deleteError);
    }

    return true;
  } catch (e) {
    console.error("cloudSave exception", e);
    return false;
  }
}
