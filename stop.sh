#!/bin/bash
PORT=${PORT:-8080}

if [ -f /tmp/remote-terminal-gui.pid ]; then
  kill $(cat /tmp/remote-terminal-gui.pid) 2>/dev/null
  rm /tmp/remote-terminal-gui.pid
fi

pkill -f "remote-terminal-gui/server.mjs" 2>/dev/null
pkill -f "cloudflared tunnel --url http://127.0.0.1:$PORT" 2>/dev/null

echo "已停止"
