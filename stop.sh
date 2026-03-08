#!/bin/bash
PORT=${TTYD_PORT:-7700}
GUI_PORT=${GUI_PORT:-8080}

if [ -f /tmp/remote-terminal-gui.pid ]; then
  kill $(cat /tmp/remote-terminal-gui.pid) 2>/dev/null
  rm /tmp/remote-terminal-gui.pid
fi

pkill -f "ttyd -p $PORT" 2>/dev/null
pkill -f "remote-terminal/server.mjs" 2>/dev/null
pkill -f "cloudflared tunnel --url http://127.0.0.1:$GUI_PORT" 2>/dev/null

echo "已停止 remote-terminal GUI"
