/**
 * 本地单元测试: 飞书签名算法 + 工具函数
 * 运行: node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hmacSha256, toHex, toBase64, safeEqual, nowSeconds } from '../src/utils.js';
import { genSign } from '../src/feishu.js';

// 官方示例: secret = "demo", timestamp = 100 (不过官方示例给出的结果无法离线对比，
// 我们用已知向量验证算法实现)
test('HMAC-SHA256 hex', async () => {
  const sig = await hmacSha256('key', 'The quick brown fox jumps over the lazy dog');
  assert.equal(
    toHex(sig),
    'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'
  );
});

test('Base64 encode', () => {
  assert.equal(toBase64(new Uint8Array([104, 105])), 'aGk=');
});

test('safeEqual', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('abc', 'ABC'), false);
});

test('genSign deterministic', async () => {
  const s1 = await genSign(100, 'demo');
  const s2 = await genSign(100, 'demo');
  assert.equal(s1, s2);
  assert.ok(s1.length > 0);
});

test('genSign differs with secret/timestamp', async () => {
  const a = await genSign(100, 'secret1');
  const b = await genSign(100, 'secret2');
  const c = await genSign(101, 'secret1');
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test('nowSeconds', () => {
  const s = nowSeconds();
  assert.ok(Math.abs(s - Math.floor(Date.now() / 1000)) <= 1);
});