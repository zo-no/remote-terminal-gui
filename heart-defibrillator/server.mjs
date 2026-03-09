#!/usr/bin/env node
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || 17701);
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('[defibrillator] TOKEN 环境变量未设置');
  process.exit(1);
}
console.log(`[defibrillator] token: ${TOKEN}`);

// ── HTTP ──────────────────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(html);
  }
  res.writeHead(404); res.end('Not Found');
});

// ── WebSocket ─────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/ws' && url.searchParams.get('token') === TOKEN) {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  } else { socket.destroy(); }
});

wss.on('connection', (ws) => {
  let activeProc = null;

  function send(obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    // 执行命令
    if (msg.type === 'run') {
      const cmd = (msg.cmd || '').trim();
      if (!cmd) return;

      if (activeProc) {
        try { activeProc.kill('SIGTERM'); } catch {}
      }

      const shellId = randomBytes(4).toString('hex');
      send({ type: 'start', shellId, cmd });

      activeProc = spawn('bash', ['-c', cmd], {
        cwd: process.env.HOME,
        env: process.env
      });

      activeProc.stdout.on('data', d => send({ type: 'out', data: d.toString() }));
      activeProc.stderr.on('data', d => send({ type: 'out', data: d.toString(), stderr: true }));
      activeProc.on('exit', (code) => {
        send({ type: 'done', code });
        activeProc = null;
      });
      activeProc.on('error', (err) => {
        send({ type: 'done', code: -1, error: err.message });
        activeProc = null;
      });
      return;
    }

    // 取消执行
    if (msg.type === 'cancel') {
      if (activeProc) {
        try { activeProc.kill('SIGTERM'); } catch {}
        activeProc = null;
        send({ type: 'done', code: -1, error: '已取消' });
      }
      return;
    }
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[defibrillator] http://127.0.0.1:${PORT}`);
});
