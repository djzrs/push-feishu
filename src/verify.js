/**
 * 入站来源的签名验证
 */

import { hmacSha256, toHex, safeEqual, nowSeconds } from './utils.js';

/**
 * GitHub webhook 签名验证
 * GitHub 使用: HMAC-SHA256(secret, raw body)，放在 X-Hub-Signature-256: sha256=...
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function verifyGithub(req, rawBody, env) {
  const secret = env.GITHUB_SECRET;
  if (!secret) {
    return { ok: false, reason: 'GITHUB_SECRET not configured' };
  }
  const sig = req.headers.get('x-hub-signature-256') || '';
  const expected = 'sha256=' + toHex(await hmacSha256(secret, rawBody));
  if (!safeEqual(sig, expected)) {
    return { ok: false, reason: 'bad signature' };
  }
  return { ok: true };
}

/**
 * 通用转发签名验证
 * 自定义规则: 请求头 X-Relay-Timestamp(秒) + X-Relay-Signature
 * 签名 = hex( HMAC-SHA256(RELAY_SECRET, `${timestamp}.${rawBody}`) )
 * 时间戳与当前时间偏差超过 MAX_SKEW 秒则拒绝(防重放)
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function verifyCustom(req, rawBody, env) {
  const secret = env.RELAY_SECRET;
  if (!secret) {
    return { ok: false, reason: 'RELAY_SECRET not configured' };
  }

  const ts = req.headers.get('x-relay-timestamp') || '';
  const sig = req.headers.get('x-relay-signature') || '';

  if (!/^\d{10}$/.test(ts)) {
    return { ok: false, reason: 'missing/invalid timestamp' };
  }

  const maxSkew = Number(env.MAX_SKEW || 300);
  if (Math.abs(nowSeconds() - Number(ts)) > maxSkew) {
    return { ok: false, reason: 'timestamp expired' };
  }

  const expected = toHex(await hmacSha256(secret, `${ts}.${rawBody}`));
  if (!safeEqual(sig, expected)) {
    return { ok: false, reason: 'bad signature' };
  }
  return { ok: true };
}

/**
 * 简单 Token 验证 (Bearer / X-Webhook-Token)
 */
export function verifyToken(req, env) {
  const token = env.WEBHOOK_TOKEN;
  if (!token) return { ok: false, reason: 'WEBHOOK_TOKEN not configured' };

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerToken = req.headers.get('x-webhook-token') || '';

  const provided = bearer || headerToken;
  if (!safeEqual(provided, token)) {
    return { ok: false, reason: 'bad token' };
  }
  return { ok: true };
}