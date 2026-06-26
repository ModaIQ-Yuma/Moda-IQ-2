import { useState } from "react";
import { AI_MODEL, AI_MAX_TOKENS } from "../constants/config.js";

/**
 * 统一的 AI 调用 hook
 * 解决了原来同一段 fetch 逻辑在代码里复制粘贴 5 次的问题
 */
export function useAI() {
  const [loading, setLoading] = useState(false);

  /**
   * @param {string} prompt - 发给 AI 的提示词
   * @param {number} [maxTokens] - 最大 token 数，默认 1000
   * @returns {Promise<string>} AI 返回的文本
   */
  async function callAI(prompt, maxTokens = AI_MAX_TOKENS) {
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content?.map(c => c.text || "").join("") || "";
    } catch (e) {
      console.error("AI call failed", e);
      return "";
    } finally {
      setLoading(false);
    }
  }

  return { callAI, loading };
}
