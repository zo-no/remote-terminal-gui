#!/bin/bash
# remote-terminal-gui: Claude Chat UI
# 依赖: cloudflared, node
# macOS: brew install cloudflared

PORT=${PORT:-8080}
WORK_DIR=${WORK_DIR:-$HOME}
DIR="$(cd "$(dirname "$0")" && pwd)"

for cmd in cloudflared node; do
  if ! command -v $cmd &>/dev/null; then
    echo "缺少依赖: $cmd"
    echo "macOS: brew install cloudflared"
    exit 1
  fi

done

pkill -f "remote-terminal-gui/server.mjs" 2>/dev/null
pkill -f "cloudflared tunnel --url http://127.0.0.1:$PORT" 2>/dev/null
sleep 1

echo "启动 GUI server (port $PORT)..."
PORT=$PORT WORK_DIR="$WORK_DIR" node "$DIR/server.mjs" > /tmp/remote-terminal-gui.log 2>&1 &
GUI_PID=$!
sleep 1

echo "启动 Cloudflare 隧道..."
TUNNEL_LOG=/tmp/remote-terminal-gui-tunnel.log
cloudflared tunnel --url http://127.0.0.1:$PORT > $TUNNEL_LOG 2>&1 &
TUNNEL_PID=$!

echo "等待隧道建立..."
for i in $(seq 1 15); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' $TUNNEL_LOG 2>/dev/null)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "隧道建立失败，查看日志: $TUNNEL_LOG"
  kill $GUI_PID $TUNNEL_PID 2>/dev/null
  exit 1
fi

echo "$GUI_PID $TUNNEL_PID" > /tmp/remote-terminal-gui.pid

echo ""
echo "======================================"
echo "  Claude Remote 已就绪"
echo "======================================"
echo ""
echo "  $URL"
echo ""
echo "  停止: ./stop.sh"
echo "======================================"
