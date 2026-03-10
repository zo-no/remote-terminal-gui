#!/usr/bin/env node
/**
 * Web Service Kit - 通用动态 Web UI 服务
 * 根据 config.json 动态渲染表单页面，用户提交后写入 callback.json
 */
import http from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || 17800);
const TOKEN = process.env.TOKEN;
const SERVICE_ID = process.env.SERVICE_ID || 'default';
const DATA_DIR = process.env.DATA_DIR || `/tmp/agent-webui/${SERVICE_ID}`;

if (!TOKEN) {
  console.error('[web-service-kit] TOKEN 未设置');
  process.exit(1);
}

// 确保数据目录存在
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// 读取配置
let config = {};
const configPath = join(DATA_DIR, 'config.json');
if (existsSync(configPath)) {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} else {
  config = { title: 'Web Service', description: '', template: 'form', fields: [], submitText: '提交', successMessage: '已提交 ✅' };
}

console.log(`[web-service-kit] service=${SERVICE_ID} port=${PORT} template=${config.template}`);

// ── 生成 HTML ──────────────────────────────────────────────────────
function generateFormHTML(cfg) {
  const fieldsHTML = (cfg.fields || []).map(f => {
    const id = `field_${f.name}`;
    const label = `<label for="${id}">${f.label || f.name}</label>`;
    let input = '';
    switch (f.type) {
      case 'textarea':
        input = `<textarea id="${id}" name="${f.name}" placeholder="${f.placeholder || ''}" rows="${f.rows || 4}"></textarea>`;
        break;
      case 'select':
        const opts = (f.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
        input = `<select id="${id}" name="${f.name}">${opts}</select>`;
        break;
      case 'radio':
        input = (f.options || []).map((o, i) =>
          `<label class="radio-label"><input type="radio" name="${f.name}" value="${o}" ${i===0?'checked':''}> ${o}</label>`
        ).join('');
        break;
      case 'checkbox':
        input = (f.options || []).map(o =>
          `<label class="checkbox-label"><input type="checkbox" name="${f.name}" value="${o}"> ${o}</label>`
        ).join('');
        break;
      case 'date':
        input = `<input type="date" id="${id}" name="${f.name}">`;
        break;
      case 'number':
        input = `<input type="number" id="${id}" name="${f.name}" min="${f.min||''}" max="${f.max||''}">`;
        break;
      default:
        input = `<input type="text" id="${id}" name="${f.name}" placeholder="${f.placeholder || ''}">`;
    }
    return `<div class="field">${label}${input}</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>${cfg.title || 'Web Service'}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f5f5f7; --surface: #fff; --border: #e5e5e5;
  --text: #1d1d1f; --muted: #86868b; --accent: #0071e3;
  --accent-hover: #0077ED; --success: #34c759; --radius: 12px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d0d0d; --surface: #1c1c1e; --border: #38383a;
    --text: #f5f5f7; --muted: #98989d; --accent: #0a84ff;
    --accent-hover: #409CFF; --success: #30d158;
  }
}
body {
  background: var(--bg); color: var(--text);
  font-family: -apple-system, 'PingFang SC', 'SF Pro', sans-serif;
  min-height: 100dvh; padding: 0;
}
.container {
  max-width: 520px; margin: 0 auto; padding: 24px 20px 40px;
}
h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
.desc { color: var(--muted); font-size: 15px; margin-bottom: 28px; line-height: 1.5; }
.field { margin-bottom: 20px; }
label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
input[type="text"], input[type="number"], input[type="date"], textarea, select {
  width: 100%; padding: 12px 14px; font-size: 16px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text);
  outline: none; transition: border-color 0.2s;
  font-family: inherit;
}
input:focus, textarea:focus, select:focus { border-color: var(--accent); }
textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%2386868b' stroke-width='2'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; }
.radio-label, .checkbox-label {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; margin: 4px 0;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; font-size: 15px;
  transition: border-color 0.2s;
}
.radio-label:has(input:checked), .checkbox-label:has(input:checked) {
  border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}
.submit-btn {
  width: 100%; padding: 14px; margin-top: 12px;
  background: var(--accent); color: #fff; border: none;
  border-radius: var(--radius); font-size: 17px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.submit-btn:hover { background: var(--accent-hover); }
.submit-btn:active { transform: scale(0.98); }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.success-screen {
  display: none; text-align: center; padding: 60px 20px;
}
.success-screen .icon { font-size: 64px; margin-bottom: 16px; }
.success-screen .msg { font-size: 18px; color: var(--muted); line-height: 1.5; }
.form-screen { display: block; }
#status { text-align: center; color: var(--muted); font-size: 13px; margin-top: 16px; }
.powered { text-align: center; color: var(--muted); font-size: 12px; margin-top: 32px; }
</style>
</head>
<body>

<div class="container">
  <div class="form-screen" id="formScreen">
    <h1>${cfg.title || ''}</h1>
    ${cfg.description ? `<div class="desc">${cfg.description}</div>` : ''}
    <form id="mainForm">
      ${fieldsHTML}
      <button type="submit" class="submit-btn" id="submitBtn">${cfg.submitText || '提交'}</button>
    </form>
    <div id="status"></div>
  </div>

  <div class="success-screen" id="successScreen">
    <div class="icon">✅</div>
    <div class="msg">${cfg.successMessage || '已提交'}</div>
  </div>

  <div class="powered">Powered by web-service-kit</div>
</div>

<script>
const form = document.getElementById('mainForm');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('status');
const formScreen = document.getElementById('formScreen');
const successScreen = document.getElementById('successScreen');

let ws = null;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = new URLSearchParams(location.search).get('token');
  if (!token) { statusEl.textContent = '缺少 token'; return; }
  ws = new WebSocket(proto + '//' + location.host + '/ws?token=' + token);
  ws.onopen = () => { statusEl.textContent = ''; };
  ws.onclose = () => { statusEl.textContent = '连接断开，请刷新'; };
  ws.onerror = () => ws.close();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'submitted') {
      formScreen.style.display = 'none';
      successScreen.style.display = 'block';
    }
  };
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || ws.readyState !== 1) { statusEl.textContent = '未连接，请刷新重试'; return; }
  submitBtn.disabled = true;
  submitBtn.textContent = '提交中...';

  const formData = new FormData(form);
  const data = {};
  // 处理 checkbox（多选）
  const checkboxNames = new Set();
  form.querySelectorAll('input[type=checkbox]').forEach(cb => checkboxNames.add(cb.name));
  checkboxNames.forEach(name => { data[name] = formData.getAll(name); });
  // 处理其他字段
  for (const [key, val] of formData.entries()) {
    if (!checkboxNames.has(key)) data[key] = val;
  }

  ws.send(JSON.stringify({ type: 'submit', data }));
});

connect();
</script>
</body>
</html>`;
}

// ── 自定义 HTML ──────────────────────────────────────────────────────
function getHTML() {
  if (config.template === 'custom') {
    const customPath = join(DATA_DIR, 'custom.html');
    if (existsSync(customPath)) return readFileSync(customPath, 'utf8');
  }
  return generateFormHTML(config);
}

// ── HTTP Server ──────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(getHTML());
  }
  // 健康检查
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', serviceId: SERVICE_ID }));
  }
  // 回调数据查询（Agent 内部用）
  if (url.pathname === '/callback') {
    const cbPath = join(DATA_DIR, 'callback.json');
    if (existsSync(cbPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(readFileSync(cbPath, 'utf8'));
    }
    res.writeHead(404);
    return res.end('no callback yet');
  }
  res.writeHead(404);
  res.end('Not Found');
});

// ── WebSocket ────────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/ws' && url.searchParams.get('token') === TOKEN) {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  console.log('[web-service-kit] client connected');

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'submit') {
      const callback = {
        serviceId: SERVICE_ID,
        timestamp: new Date().toISOString(),
        data: msg.data || {}
      };

      // 写入回调文件
      const cbPath = join(DATA_DIR, 'callback.json');
      writeFileSync(cbPath, JSON.stringify(callback, null, 2));
      console.log(`[web-service-kit] callback saved: ${cbPath}`);

      // 通知客户端
      ws.send(JSON.stringify({ type: 'submitted' }));

      // 通知所有连接的客户端
      wss.clients.forEach(c => {
        if (c !== ws && c.readyState === 1) {
          c.send(JSON.stringify({ type: 'submitted' }));
        }
      });
    }
  });

  ws.on('close', () => {
    console.log('[web-service-kit] client disconnected');
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[web-service-kit] http://127.0.0.1:${PORT}`);
});
