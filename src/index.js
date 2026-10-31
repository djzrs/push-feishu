/**
 * Cloudflare Worker 主入口
 * 转发各种 webhook 到飞书群机器人
 */

import { json, readBodyText } from './utils.js';
import { pushToFeishu } from './feishu.js';
import { verifyGithub, verifyCustom, verifyToken } from './verify.js';
import { githubEventToText } from './github.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 预检（可选，非必需）
    if (request.method === 'OPTIONS') {
      return new Response('ok', { status: 204 });
    }

    // 仅允许 POST
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      // ---- 路由: /github —— GitHub webhook 专用入口 ----
      if (path === '/github') {
        return await handleGithub(request, env, ctx);
      }

      // ---- 路由: / —— 通用转发入口 ----
      if (path === '/' || path === '/generic') {
        return await handleGeneric(request, env, ctx);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: 'internal error', detail: String(err?.message || err) }, 500);
    }
  },
};

/** GitHub 事件处理 */
async function handleGithub(request, env, ctx) {
  const event = request.headers.get('x-github-event') || 'unknown';
  const rawBody = await readBodyText(request);

  // 验证 GitHub 签名
  const v = await verifyGithub(request, rawBody, env);
  if (!v.ok) {
    return json({ error: 'unauthorized', reason: v.reason }, 401);
  }

  // 解析 JSON
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // 过滤不需要的事件类型
  const allowed = (env.GITHUB_EVENTS || 'push,ping')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.includes(event)) {
    return json({ received: true, skipped: true, event });
  }

  // 构造飞书消息
  const text = githubEventToText(event, payload, env);
  if (!text) {
    return json({ received: true, skipped: true, event });
  }

  const message = { msg_type: 'text', content: { text } };

  // 先立即返回 200，再异步推送，避免源站等待
  ctx.waitUntil(
    (async () => {
      const r = await pushToFeishu(message, env.FEISHU_WEBHOOK_URL, env.FEISHU_SECRET || '');
      console.log('feishu push result', JSON.stringify(r));
    })()
  );

  return json({ received: true, event });
}

/** 通用转发处理 */
async function handleGeneric(request, env, ctx) {
  const rawBody = await readBodyText(request);

  // 验证来源（三种方式任选其一，按配置情况启用）
  // 1) Bearer Token
  if (env.WEBHOOK_TOKEN) {
    const v = verifyToken(request, env);
    if (!v.ok) return json({ error: 'unauthorized', reason: v.reason }, 401);
  }
  // 2) 自定义签名 (RELAY_SECRET)
  if (env.RELAY_SECRET) {
    const v = await verifyCustom(request, rawBody, env);
    if (!v.ok) return json({ error: 'unauthorized', reason: v.reason }, 401);
  }
  // 两者都没配 → 裸奔模式，允许（不推荐）
  if (!env.WEBHOOK_TOKEN && !env.RELAY_SECRET) {
    return json(
      { error: 'no auth configured: set WEBHOOK_TOKEN or RELAY_SECRET' },
      500
    );
  }

  // 解析请求体
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // 消息构造规则:
  //  - 若请求体本身就是飞书格式(含 msg_type)，则原样转发
  //  - 否则包装成 text 消息: 取 body.text / body.message / body.msg / 整个 JSON 字符串
  let message;
  if (payload.msg_type) {
    message = payload;
  } else {
    const text =
      payload.text ||
      payload.message ||
      payload.msg ||
      (typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
    message = { msg_type: 'text', content: { text: String(text) } };
  }

  ctx.waitUntil(
    (async () => {
      const r = await pushToFeishu(message, env.FEISHU_WEBHOOK_URL, env.FEISHU_SECRET || '');
      console.log('feishu push result', JSON.stringify(r));
    })()
  );

  return json({ received: true });
}