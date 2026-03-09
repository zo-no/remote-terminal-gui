#!/bin/bash
# heart-defibrillator: 心脏复苏器
# 远程执行 openclaw 修复命令

PORT=${PORT:-17701}
DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$(openssl rand -hex 8)

for cmd in cloudflared node; do
  if ! command -v $cmd &>/dev/null; then
    echo "缺少依赖: $cmd"
    echo "macOS: brew install cloudflared"
    exit 1
  fi
done

# 停止旧进程
pkill -f "heart-defibrillator/server.mjs" 2>/dev/null
pkill -f "cloudflared tunnel --url http://127.0.0.1:$PORT" 2>/dev/null
sleep 1

echo "启动心脏复苏器 (port $PORT)..."
PORT=$PORT TOKEN=$TOKEN node "$DIR/server.mjs" > /tmp/heart-defibrillator.log 2>&1 &
PID=$!

# 等待端口
for i in $(seq 1 10); do
  lsof -ti :$PORT &>/dev/null && break
  sleep 0.5
done
if ! lsof -ti :$PORT &>/dev/null; then
  echo "启动失败，查看日志: /tmp/heart-defibrillator.log"
  tail -5 /tmp/heart-defibrillator.log
  kill $PID 2>/dev/null
  exit 1
fi

echo "启动 Cloudflare 隧道..."
TUNNEL_LOG=/tmp/heart-defibrillator-tunnel.log
cloudflared tunnel --url http://127.0.0.1:$PORT > $TUNNEL_LOG 2>&1 &
TUNNEL_PID=$!

echo "等待隧道建立..."
for i in $(seq 1 15); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' $TUNNEL_LOG 2>/dev/null)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "隧道建立失败"
  kill $PID $TUNNEL_PID 2>/dev/null
  exit 1
fi

echo "$PID $TUNNEL_PID" > /tmp/heart-defibrillator.pid

echo ""
echo "======================================"
echo "  ⚡ 心脏复苏器已就绪"
echo "======================================"
echo ""
echo "$URL?token=$TOKEN"
echo ""
echo "停止: ./stop.sh"
echo "======================================"
