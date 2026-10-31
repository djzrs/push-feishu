/**
 * 模拟飞书机器人接收端（本地测试用）
 * 验证 Worker 推送时是否正确携带签名
 *
 * 用法: node test/mock-feishu-server.js <port>
 * 监听 POST /open-apis/bot/v2/hook/TEST_HOOK
 * 校验 timestamp + sign，返回 code 0 或 19021
 */

import http from 'node:http';
import { hmacSha256, toBase64 } from '../src/utils.js';

const SECRET = 'test-feishu-secret';
const PORT = Number(process.argv[2] || 8899);

const server = http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }

  res.setHeader('Content-Type', 'application/json');

  if (!body || !body.msg_type) {
    res.writeHead(400);
    res.end(JSON.stringify({ code: 9499, msg: 'Bad Request' }));
    return;
  }

  // 验证飞书签名
  if (body.sign && body.timestamp) {
    const stringToSign = `${body.timestamp}\n${SECRET}`;
    const expected = toBase64(await hmacSha256(stringToSign, ''));
    if (expected !== body.sign) {
      console.log('❌ 签名不匹配! 期望:', expected, '实际:', body.sign);
      res.writeHead(200);
      res.end(JSON.stringify({ code: 19021, msg: 'sign match fail' }));
      return;
    }
    console.log('✅ 飞书签名验证通过');
  } else {
    console.log('⚠️ 请求缺少 timestamp/sign');
  }

  console.log('📨 收到消息:', JSON.stringify(body.content || body.card, null, 2));
  res.writeHead(200);
  res.end(JSON.stringify({ code: 0, msg: 'success', data: {} }));
});

server.listen(PORT, () => {
  console.log(`Mock Feishu server listening on http://localhost:${PORT}`);
});