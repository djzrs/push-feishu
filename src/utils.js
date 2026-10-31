/**
 * 通用工具函数
 */

/** 将字符串编码为 UTF-8 字节 */
const enc = (s) => new TextEncoder().encode(s);

/** HMAC-SHA256，返回原始字节 */
export async function hmacSha256(key, data) {
  const crypto = globalThis.crypto;
  const keyBuf = await crypto.subtle.importKey(
    'raw',
    enc(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', keyBuf, enc(data));
  return new Uint8Array(sig);
}

/** 字节数组转小写十六进制字符串 */
export function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 字节数组转 Base64 字符串 */
export function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * 常量时间字符串比较，防时序攻击。
 * 若签名长度/内容不一致返回 false。
 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 构造 JSON 响应 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** 读取请求原始 body（文本） */
export async function readBodyText(request) {
  return await request.text();
}

/** 当前秒级 Unix 时间戳 */
export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}