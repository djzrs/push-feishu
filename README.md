# CF Feishu Webhook 转发器

用 **Cloudflare Worker** 把任意系统的 Webhook 转发到**飞书群机器人**。
无需服务器，免费额度（每天 10 万次请求）。

```
GitHub / 监控 / 自定义脚本  ──POST──▶  Cloudflare Worker  ──带签名──▶  飞书群机器人
```

## 功能

- **通用入口** `POST /`：其他系统发 JSON 过来，Worker 包装成飞书消息并推送
- **GitHub 入口** `POST /github`：验证 GitHub 签名，把事件格式化成中文文本再推送
- **飞书签名**：出站自动计算 `timestamp + "\n" + secret` 的 HmacSHA256 签名，防止有人拿你的 webhook 地址乱发
- **来源认证**：支持 Bearer Token 或自定义 HMAC 签名（含防重放时间戳）
- **异步推送**：先返回 200 给来源方，再后台推送，避免等待超时

## 目录结构

```
cf-feishu-webhook/
├── wrangler.toml        # Worker 配置
├── package.json
├── send.sh              # 带签名发送测试脚本
└── src/
    ├── index.js          # 主入口 + 路由
    ├── feishu.js         # 飞书签名 + 推送
    ├── verify.js         # 入站签名验证 (GitHub / 自定义)
    ├── github.js         # GitHub 事件格式化
    └── utils.js          # 工具函数
```

## 一、准备工作

1. 在飞书群里添加**自定义机器人**，复制 webhook 地址：
   `https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxxxxxxxxxx`
2. 建议在机器人「安全设置」里开启**签名校验**，复制密钥（secret）。
   - 不开启也能用，但任何人都知道 webhook 地址就能往群里发消息。
3. 安装 Node.js 18+ 和 wrangler：
   ```bash
   npm install -g wrangler
   ```

## 二、部署

```bash
cd cf-feishu-webhook
npm install
npx wrangler login          # 浏览器登录 Cloudflare

# 设置机密变量
npx wrangler secret put FEISHU_WEBHOOK_URL
# 粘贴: https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx

npx wrangler secret put FEISHU_SECRET
# 粘贴: 飞书机器人签名密钥（开启签名校验才需要）

# GitHub 专用入口需要:
npx wrangler secret put GITHUB_SECRET
# 粘贴: 一串随机字符串，稍后在 GitHub 仓库里填同一个

# 通用入口可选（二选一即可）:
npx wrangler secret put WEBHOOK_TOKEN
npx wrangler secret put RELAY_SECRET

# 部署
npx wrangler deploy
```

部署完成后会输出一个 URL：`https://cf-feishu-webhook.<你的子域>.workers.dev`。

## 三、接入 GitHub

1. GitHub 仓库 → **Settings → Webhooks → Add webhook**
2. **Payload URL**：`https://cf-feishu-webhook.<你的子域>.workers.dev/github`
3. **Content type**：必须选 `application/json`
4. **Secret**：填刚才 `GITHUB_SECRET` 的同一个值
5. **事件**：选 `Let me select`，勾选 Push、Pull requests、Issues、Stars 等
6. 保存后 GitHub 会发一个 `ping`，群里会收到「✅ GitHub Webhook 已连通」

## 四、接入其他系统（通用入口）

向 `https://cf-feishu-webhook.<你的子域>.workers.dev/` 发 POST：

```bash
curl -X POST https://cf-feishu-webhook.<子域>.workers.dev/ \
  -H "Authorization: Bearer <你的WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"text": "服务器负载过高!"}'
```

Worker 会把请求包装成飞书文本消息推送。也支持以下字段提取：
`text` / `message` / `msg`，或者直接传飞书格式 `{"msg_type": "post", ...}` 原样转发。

### 自定义签名模式（可选）

在请求头带上签名，防止 token 泄露后被乱用：

```bash
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" '{"text":"hello"}' | openssl dgst -sha256 -hmac "$RELAY_SECRET" -hex | awk '{print $NF}')

curl -X POST https://cf-feishu-webhook.<子域>.workers.dev/ \
  -H "X-Relay-Timestamp: $TS" \
  -H "X-Relay-Signature: $SIG" \
  -H "Content-Type: application/json" \
  -d '{"text":"hello"}'
```

## 五、测试

### 本地测试

```bash
npx wrangler dev
```

然后另一个终端：

```bash
# 不带签名推送到飞书（如果开启了签名校验会失败）
curl -X POST http://localhost:8787/ \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{"text": "hello 飞书"}'
```

### 直接测试飞书机器人（不需要 Worker）

```bash
# 未开启签名校验
WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx" ./send.sh "你好飞书"

# 开启签名校验
WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx" ./send.sh "你好飞书" "你的secret"
```

## 常见问题

**飞书返回 `19021`**
签名校验失败。检查 secret 是否一致；检查机器/server 时间是否偏差超过 1 小时。

**飞书返回 `11232`**
触发限流。单机器人限制 100 次/分钟、5 次/秒，避免整点/半点集中发送。

**GitHub 不发消息**
检查 Worker 日志（`wrangler tail`）里的 `feishu push result`；确认 GitHub 事件类型在 `GITHUB_EVENTS` 列表里；确认 `Content type` 是 `application/json`。

**飞书提示 `Bad Request` (9499)**
请求体超过 20KB，或不是合法的飞书消息格式。

## 环境变量一览

| 变量 | 必填 | 说明 |
|---|---|---|
| `FEISHU_WEBHOOK_URL` | ✅ | 飞书机器人 webhook 地址 |
| `FEISHU_SECRET` | 可选 | 飞书机器人签名密钥 |
| `GITHUB_SECRET` | GitHub入口 | GitHub webhook secret |
| `GITHUB_EVENTS` | 可选 | 允许的事件列表，默认 `push,ping,pull_request,issues,issue_comment,star,fork,release,watch` |
| `WEBHOOK_TOKEN` | 通用入口 | Bearer Token 鉴权 |
| `RELAY_SECRET` | 通用入口 | 自定义 HMAC 签名密钥（与 TOKEN 二选一） |
| `MAX_SKEW` | 可选 | 自定义签名时间戳最大偏差，默认 300 秒 |

## 参考

- 飞书自定义机器人文档：https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
- Cloudflare Workers：https://developers.cloudflare.com/workers/