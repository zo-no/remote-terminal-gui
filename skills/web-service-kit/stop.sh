#!/bin/bash
# web-service-kit: 停止服务
# 用法: SERVICE_ID="diary-20260310" bash stop.sh
#   或: bash stop.sh <service-id>

SERVICE_ID=${1:-${SERVICE_ID:-default}}
PID_FILE="/tmp/agent-webui/${SERVICE_ID}.pid"

if [ -f "$PID_FILE" ]; then
  read GUI_PID TUNNEL_PID PORT < "$PID_FILE"
  echo "[web-service-kit] 停止服务 service=$SERVICE_ID (pids: $GUI_PID $TUNNEL_PID)"
  kill $GUI_PID $TUNNEL_PID 2>/dev/null
  rm -f "$PID_FILE"
  echo "[web-service-kit] 已停止"
else
  echo "[web-service-kit] 未找到运行中的服务: $SERVICE_ID"
fi
