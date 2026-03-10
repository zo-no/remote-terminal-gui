---
name: nocode-deploy
description: Deploy dynamic Web pages via NoCode platform (nocode.cn). Agent generates page descriptions, automates browser to create and deploy projects, returns a fixed shareable URL. Use when tunnel-based deployment is unavailable.
---

# NoCode Deploy

Deploy Web pages via NoCode (nocode.cn) using browser automation.

## Commands

```bash
python3 nocode_browser.py login                    # Login (scan QR)
python3 nocode_browser.py status                   # Check login status
python3 nocode_browser.py deploy -p "prompt" -n "name"  # Deploy
```

## Requirements

- Chrome with `--remote-debugging-port=9222`
- `pip install websocket-client`

## vs web-service-kit

| | web-service-kit | nocode-deploy |
|--|----------------|---------------|
| Deploy | Cloudflare tunnel | NoCode platform |
| URL | Random, one-time | Fixed, shareable |
| Customization | Full control | AI-generated |
| Network | Needs outbound | Internal only |
