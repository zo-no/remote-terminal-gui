# web-service-kit 🌐

An OpenClaw skill that lets AI agents dynamically generate Web UIs, expose them via Cloudflare tunnel, and collect user input.

## Why?

Plain text chat can't handle everything. Sometimes you need a form, a survey, a diary page, or a file uploader. This skill bridges that gap.

```
User request → Agent generates config → Web server starts → Cloudflare tunnel → User fills form → Data returns to Agent
```

## Features

- 📋 **Dynamic forms** from JSON config
- 🌐 **Auto tunnel** via Cloudflare (free, no setup)
- 📱 **Mobile-friendly** Apple-style UI with dark mode
- 🔒 **Token auth** per session
- 🔄 **WebSocket** real-time submit
- 📦 **Zero config** - just create config.json and run

## Install

```bash
npm install
```

## Usage

```bash
# Create config
mkdir -p /tmp/agent-webui/my-service
cat > /tmp/agent-webui/my-service/config.json << 'CONFIG'
{
  "title": "Daily Journal 📝",
  "fields": [
    {"name": "mood", "label": "Mood", "type": "select", "options": ["😊 Happy", "😐 Meh", "🔥 Productive"]},
    {"name": "notes", "label": "Notes", "type": "textarea", "placeholder": "What happened today..."}
  ]
}
CONFIG

# Start
SERVICE_ID="my-service" bash start.sh

# Stop
bash stop.sh my-service
```

## License

MIT
