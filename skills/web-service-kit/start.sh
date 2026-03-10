#!/bin/bash
# web-service-kit: 动态 Web UI 服务启动脚本
# 用法: SERVICE_ID="diary-20260310" bash start.sh
# 依赖: node, cloudflared

PORT=${PORT:-17800}
SERVICE_ID=${SERVICE_ID:-default}
DATA_DIR=${DATA_DIR:-/tmp/agent-webui/$SERVICE_ID}
DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN=$(openssl rand -hex 8)
PID_FILE="/tmp/agent-webui/${SERVICE_ID}.pid"
LOG_FILE="/tmp/agent-webui/${SERVICE_ID}.log"
TUNNEL_LOG="/tmp/agent-webui/${SERVICE_ID}-tunnel.log"

# 确保数据目录存在
mkdir -p "$DATA_DIR"

# 检查依赖
for cmd in node; do
  if ! command -v $cmd &>/dev/null; then
    echo "缺少依赖: $cmd"
    exit 1
  fi
done

# 检查 cloudflared
if ! command -v cloudflared &>/dev/null; then
  echo "安装 cloudflared..."
  if [[ "$(uname)" == "Darwin" ]]; then
    brew install cloudflared
  else
    # Linux: 直接下载二进制
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
      CF_ARCH="amd64"
    elif [ "$ARCH" = "aarch64" ]; then
      CF_ARCH="arm64"
    else
      CF_ARCH="amd64"
    fi
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
  fi
fi

# 停止旧进程（同 SERVICE_ID）
if [ -f "$PID_FILE" ]; then
  read GUI_PID TUNNEL_PID < "$PID_FILE"
  kill $GUI_PID $TUNNEL_PID 2>/dev/null
  rm -f "$PID_FILE"
  sleep 1
fi

# 找可用端口
while lsof -ti :$PORT &>/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "[web-service-kit] 启动服务 service=$SERVICE_ID port=$PORT"
PORT=$PORT SERVICE_ID=$SERVICE_ID DATA_DIR=$DATA_DIR TOKEN=$TOKEN node "$DIR/server.mjs" > "$LOG_FILE" 2>&1 &
GUI_PID=$!

# 等待端口就绪
for i in $(seq 1 10); do
  lsof -ti :$PORT &>/dev/null 2>&1 && break
  # 备用检测：尝试 curl
  curl -s http://127.0.0.1:$PORT/health > /dev/null 2>&1 && break
  sleep 0.5
done

if ! curl -s http://127.0.0.1:$PORT/health > /dev/null 2>&1; then
  # 再等一下
  sleep 2
  if ! curl -s http://127.0.0.1:$PORT/health > /dev/null 2>&1; then
    echo "Server 启动失败，查看日志: $LOG_FILE"
    tail -5 "$LOG_FILE" 2>/dev/null
    kill $GUI_PID 2>/dev/null
    exit 1
  fi
fi

echo "[web-service-kit] 启动 Cloudflare 隧道..."
cloudflared tunnel --url http://127.0.0.1:$PORT > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

echo "[web-service-kit] 等待隧道建立..."
URL=""
for i in $(seq 1 20); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "隧道建立失败，查看日志: $TUNNEL_LOG"
  kill $GUI_PID $TUNNEL_PID 2>/dev/null
  exit 1
fi

echo "$GUI_PID $TUNNEL_PID $PORT" > "$PID_FILE"

echo ""
echo "======================================"
echo "  🦘 Web Service 已就绪"
echo "======================================"
echo ""
echo "SERVICE_ID: $SERVICE_ID"
echo "URL: $URL?token=$TOKEN"
echo ""
echo "停止: SERVICE_ID=$SERVICE_ID bash $(dirname $0)/stop.sh"
echo "======================================"
