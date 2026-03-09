#!/bin/bash
# 停止心脏复苏器

if [ -f /tmp/heart-defibrillator.pid ]; then
  read GUI_PID TUNNEL_PID < /tmp/heart-defibrillator.pid
  kill $GUI_PID $TUNNEL_PID 2>/dev/null
  rm /tmp/heart-defibrillator.pid
fi

pkill -f "heart-defibrillator/server.mjs" 2>/dev/null
pkill -f "cloudflared tunnel --url http://127.0.0.1:17701" 2>/dev/null

echo "心脏复苏器已停止"
