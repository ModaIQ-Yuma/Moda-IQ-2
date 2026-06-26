// =============================================================
//  Moda.IQ — AI 中转后端（桥梁）  对接 vectorengine 中转站
//  流程：前端调用 /api/ai → 这里带上中转站密钥 → 请求 vectorengine → 翻译格式后返回
//  密钥来自 Vercel 环境变量 VECTORENGINE_API_KEY（绝不写在代码里，用户看不到）
// =============================================================

// —— 可配置项：将来要换中转站 / 换模型，只改这三行即可 ——
const RELAY_URL = "https://api.vectorengine.cn/v1/chat/completions"; // 中转站接口地址
const MODEL = "claude-opus-4-8";                                     // 使用的模型
const ENV_KEY_NAME = "VECTORENGINE_API_KEY";                         // Vercel 环境变量名

export default async function handler(req, res) {
  // 1) 只允许 POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 2) 读取密钥（存在 Vercel 后台）
  const apiKey = process.env[ENV_KEY_NAME];
  if (!apiKey) {
    return res.status(200).json({
      content: [{ type: "text", text: `⚠️ 服务器未配置密钥（${ENV_KEY_NAME}）。请在 Vercel 环境变量中设置该值后，重新部署。` }],
    });
  }

  // 3) 读取前端传来的 body（兼容字符串/对象）
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  try {
    // 4) 用 OpenAI 格式、带密钥，请求中转站
    const upstream = await fetch(RELAY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: body.max_tokens || 1000,
        messages: body.messages || [],
      }),
    });

    const data = await upstream.json();

    // 5) 翻译：中转站返回 OpenAI 格式(choices[0].message.content)
    //    → 翻回你前端要的 Claude 格式(content[].text)
    const text =
      data?.choices?.[0]?.message?.content ??
      data?.error?.message ??
      "";

    if (!text) {
      // 返回为空时，把原始返回带上一点，方便排查（比如额度不足、模型名不对）
      return res.status(200).json({
        content: [{ type: "text", text: `⚠️ AI 返回为空。中转站原始返回：${JSON.stringify(data).slice(0, 600)}` }],
      });
    }

    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (err) {
    return res.status(200).json({
      content: [{ type: "text", text: `⚠️ AI 请求失败：${String(err)}` }],
    });
  }
}
