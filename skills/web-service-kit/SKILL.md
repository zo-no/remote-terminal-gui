---
name: web-service-kit
description: Dynamic Web UI service for AI agents. Generates forms/selectors via config.json, exposes via Cloudflare tunnel, collects user input and returns data to the agent. Use when plain text chat can't handle complex interactions (forms, surveys, diaries, file uploads).
---

# Web Service Kit

Generate dynamic Web UIs, expose them via Cloudflare tunnel, let users interact in their browser, and get the data back.

## Quick Start

### 1. Install dependencies

```bash
cd web-service-kit && npm install
```

### 2. Create config

Create `config.json` in your data directory:

```json
{
  "title": "Daily Journal 📝",
  "description": "Record your thoughts",
  "template": "form",
  "fields": [
    {"name": "mood", "label": "Mood", "type": "select", "options": ["😊 Happy", "😐 Neutral", "😔 Down", "🔥 Productive"]},
    {"name": "highlight", "label": "Highlight", "type": "textarea", "placeholder": "Best thing today..."},
    {"name": "reflection", "label": "Reflection", "type": "textarea", "placeholder": "Thoughts..."}
  ],
  "submitText": "Submit",
  "successMessage": "Saved ✅"
}
```

### 3. Start service

```bash
SERVICE_ID="journal-20260310" bash start.sh
```

### 4. Get callback

User submits → data written to: `$DATA_DIR/callback.json`

### 5. Stop

```bash
bash stop.sh <service-id>
```

## Field Types

| type | Description | Extra params |
|------|-------------|-------------|
| text | Single line | placeholder |
| textarea | Multi line | placeholder, rows |
| select | Dropdown | options: string[] |
| radio | Single choice | options: string[] |
| checkbox | Multi choice | options: string[] |
| date | Date picker | - |
| number | Number | min, max |
| file | File upload | accept |

## Custom HTML

Set `"template": "custom"` in config.json and place `custom.html` in the data directory.

## Decision Path: When to Use Web UI

Score the task:

```
web_score = 0
if input_fields > 2:       +3
if has_file_upload:         +3
if has_selector_or_date:    +2
if needs_visualization:     +3
if repeated_use:            +2
if mobile_friendly_needed:  +2

>= 5 → Launch Web service
3-4  → Suggest Web, ask user
< 3  → Plain text reply
```

## Security

- Random token per session
- One-time use: auto-stop after submit
- No persistent port exposure
- Data stays local

## Requirements

- Node.js >= 18
- cloudflared (auto-installed if missing)

## License

MIT
