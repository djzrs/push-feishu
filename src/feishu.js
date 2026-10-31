/**
 * 飞书自定义机器人签名 + 推送
 * 参考: https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
 *
 * 签名算法:
 *   stringToSign = `${timestamp}\n${secret}`
 *   sign = Base64( HMAC-SHA256(key = stringToSign, message = "") )
 * 请求体携带 timestamp 和 sign 字段
 */

import { hmacSha256, toBase64, nowSeconds } from './utils.js';

/**
 * 生成飞书机器人签名
 * @param {number|string} timestamp 秒级 Unix 时间戳
 * @param {string} secret 机器人的签名密钥
 * @returns {Promise<string>} Base64 签名
 */
export async function genSign(timestamp, secret) {
  // 注意: 整个 stringToSign 作为 HMAC 的 key，message 是空字符串
  const stringToSign = `${timestamp}\n${secret}`;
  const sig = await hmacSha256(stringToSign, '');
  return toBase64(sig);
}

/**
 * 推送消息到飞书群机器人
 * @param {object} payload 飞书消息体 (msg_type + content 或 card)
 * @param {string} webhookUrl 飞书机器人 webhook 地址
 * @param {string} secret 签名密钥 (未开启签名校验则传空字符串)
 * @returns {Promise<{ok: boolean, status: number, body: any}>}
 */
export async function pushToFeishu(payload, webhookUrl, secret) {
  const body = { ...payload };

  if (secret) {
    const timestamp = nowSeconds();
    const sign = await genSign(timestamp, secret);
    body.timestamp = String(timestamp);
    body.sign = sign;
  }

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let result = null;
  try {
    result = await resp.json();
  } catch {
    result = null;
  }

  return { ok: resp.ok && result?.code === 0, status: resp.status, body: result };
}