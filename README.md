# remote-terminal-gui

A collection of OpenClaw skills for exposing dynamic Web UIs via Cloudflare tunnel.

## Skills

| Skill | Description |
|-------|-------------|
| `remote-terminal/` | Remote terminal access with Claude chat + shell |
| `heart-defibrillator/` | Emergency heartbeat recovery UI |
| `web-service-kit/` | **NEW** - Dynamic form/survey/diary Web UI generator |

## web-service-kit (New!)

Generate dynamic Web UIs from JSON config. Users fill forms in their browser, data returns to your agent.

```
Agent → config.json → Web server → Cloudflare tunnel → User browser → callback.json → Agent
```

Features:
- 📋 Dynamic forms from JSON
- 🌐 Auto Cloudflare tunnel
- 📱 Mobile-friendly dark mode UI
- 🔒 Token-based auth
- 🔄 WebSocket real-time

See [skills/web-service-kit/README.md](skills/web-service-kit/README.md) for details.
