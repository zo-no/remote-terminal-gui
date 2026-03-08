#!/bin/bash
# GUI 版：ttyd + 自定义页面（快捷按钮 + 移动端优化）
# 依赖: ttyd, cloudflared, node

PORT=${TTYD_PORT:-7700}
GUI_PORT=${GUI_PORT:-8080}
DIR="$(cd "$(dirname "$0")" && pwd)"

for cmd in ttyd cloudflared node; do
  if ! command -v $cmd &>/dev/null; then
    echo "缺少依赖: $cmd  (macOS: brew install ttyd cloudflared)"
    exit 1
  fi
done

pkill -f "ttyd -p $PORT" 2>/dev/null
pkill -f "remote-terminal/server.mjs" 2>/dev/null
pkill -f "cloudflared tunnel --url http://127.0.0.1:$GUI_PORT" 2>/dev/null
sleep 1

SHELL_CMD=$([ "$(uname -s)" = "Darwin" ] && echo "zsh" || echo "bash")

echo "启动 ttyd (port $PORT)..."
ttyd -p $PORT --writable env -u CLAUDECODE -u CLAUDE_CODE $SHELL_CMD > /tmp/ttyd.log 2>&1 &
TTYD_PID=$!
sleep 1

echo "启动 GUI server (port $GUI_PORT)..."
TTYD_PORT=$PORT PORT=$GUI_PORT node "$DIR/server.mjs" > /tmp/gui.log 2>&1 &
GUI_PID=$!
sleep 1

echo "启动 Cloudflare 隧道..."
TUNNEL_LOG=/tmp/remote-terminal-tunnel.log
cloudflared tunnel --url http://127.0.0.1:$GUI_PORT > $TUNNEL_LOG 2>&1 &
TUNNEL_PID=$!

echo "等待隧道建立..."
for i in $(seq 1 15); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' $TUNNEL_LOG 2>/dev/null)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "隧道建立失败，查看日志: $TUNNEL_LOG"
  kill $TTYD_PID $GUI_PID $TUNNEL_PID 2>/dev/null
  exit 1
fi

echo "$TTYD_PID $GUI_PID $TUNNEL_PID" > /tmp/remote-terminal-gui.pid

echo ""
echo "======================================"
echo "  Remote Terminal (GUI) 已就绪"
echo "======================================"
echo ""
echo "  $URL"
echo ""
echo "  停止服务: ./stop.sh"
echo "======================================"
