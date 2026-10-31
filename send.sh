# 发送带签名校验的消息到飞书群机器人
# 用法: ./send.sh "要发送的文本" [secret]

set -euo pipefail

MESSAGE="${1:?usage: ./send.sh <message> [secret]}"
SECRET="${2:-}"
WEBHOOK_URL="${WEBHOOK_URL:-}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "请先设置 WEBHOOK_URL 环境变量" >&2
  exit 1
fi

if [ -n "$SECRET" ]; then
  TS=$(date +%s)
  # 签名 = Base64( HMAC-SHA256(key = "${TS}\n${SECRET}", message = "") )
  SIGN=$(printf '%s\n%s' "$TS" "$SECRET" | openssl dgst -sha256 -hmac "" -binary | base64)
  PAYLOAD=$(jq -n --arg ts "$TS" --arg sign "$SIGN" --arg text "$MESSAGE" \
    '{timestamp: $ts, sign: $sign, msg_type: "text", content: {text: $text}}')
else
  PAYLOAD=$(jq -n --arg text "$MESSAGE" \
    '{msg_type: "text", content: {text: $text}}')
fi

curl -sS -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
echo