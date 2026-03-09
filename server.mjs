#!/usr/bin/env node
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn, execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || 8080);
const WORK_DIR = process.env.WORK_DIR || process.env.HOME;
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('[server] TOKEN 环境变量未设置');
  process.exit(1);
}
console.log(`[server] token: ${TOKEN}`);

function resolveClaude() {
  const home = process.env.HOME || '';
  const candidates = [
    `${home}/.nvm/versions/node/v18.20.8/bin/claude`,
    `${home}/Library/pnpm/claude`,
    `/opt/homebrew/bin/claude`,
    `/usr/local/bin/claude`,
    `/usr/bin/claude`,
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  try { return execFileSync('which', ['claude'], { encoding: 'utf8' }).trim(); }
  catch { return 'claude'; }
}
const CLAUDE_BIN = resolveClaude();
console.log(`[server] claude: ${CLAUDE_BIN}, workdir: ${WORK_DIR}`);

// ── 会话存储（内存） ──────────────────────────────────────────────────────
// sessions: Map<sessionId, { id, name, claudeSessionId, history: [], proc }>
const sessions = new Map();

function createSession(name) {
  const id = randomBytes(6).toString('hex');
  const session = { id, name: name || `会话 ${sessions.size + 1}`, claudeSessionId: null, history: [], proc: null };
  sessions.set(id, session);
  return session;
}

function sessionSummary(s) {
  return { id: s.id, name: s.name, messageCount: s.history.length };
}

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
  let activeSessionId = null;

  function send(obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function pushHistory(session, role, text) {
    session.history.push({ role, text, ts: Date.now() });
  }

  // 初始化：发送会话列表，自动创建第一个会话
  const initial = createSession('默认会话');
  activeSessionId = initial.id;
  send({ type: 'init', sessions: [...sessions.values()].map(sessionSummary), activeId: activeSessionId });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    // ── 会话管理 ──
    if (msg.type === 'session_new') {
      const s = createSession(msg.name || null);
      activeSessionId = s.id;
      send({ type: 'sessions_updated', sessions: [...sessions.values()].map(sessionSummary), activeId: activeSessionId });
      send({ type: 'session_switched', sessionId: s.id, history: [] });
      return;
    }

    if (msg.type === 'session_switch') {
      const s = sessions.get(msg.sessionId);
      if (!s) return;
      // 停止当前会话的进程
      const cur = sessions.get(activeSessionId);
      if (cur?.proc) { try { cur.proc.kill('SIGTERM'); } catch {} cur.proc = null; }
      activeSessionId = s.id;
      send({ type: 'session_switched', sessionId: s.id, history: s.history });
      return;
    }

    if (msg.type === 'session_delete') {
      const s = sessions.get(msg.sessionId);
      if (!s) return;
      if (s.proc) { try { s.proc.kill('SIGTERM'); } catch {} }
      sessions.delete(msg.sessionId);
      // 如果删的是当前会话，切到第一个或新建
      if (activeSessionId === msg.sessionId) {
        if (sessions.size === 0) {
          const ns = createSession('默认会话');
          activeSessionId = ns.id;
        } else {
          activeSessionId = sessions.keys().next().value;
        }
        const ns = sessions.get(activeSessionId);
        send({ type: 'session_switched', sessionId: activeSessionId, history: ns.history });
      }
      send({ type: 'sessions_updated', sessions: [...sessions.values()].map(sessionSummary), activeId: activeSessionId });
      return;
    }

    if (msg.type === 'session_rename') {
      const s = sessions.get(msg.sessionId);
      if (s) { s.name = msg.name; }
      send({ type: 'sessions_updated', sessions: [...sessions.values()].map(sessionSummary), activeId: activeSessionId });
      return;
    }

    // ── 发送消息 ──
    if (msg.type === 'send') {
      const prompt = (msg.text || '').trim();
      if (!prompt) return;

      const session = sessions.get(activeSessionId);
      if (!session) return;

      if (session.proc) { try { session.proc.kill('SIGTERM'); } catch {} session.proc = null; }

      pushHistory(session, 'user', prompt);
      send({ type: 'status', text: 'thinking' });

      const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
      if (session.claudeSessionId) args.push('--resume', session.claudeSessionId);

      const env = { ...process.env };
      delete env.CLAUDECODE;
      delete env.CLAUDE_CODE_ENTRYPOINT;

      const proc = spawn(CLAUDE_BIN, args, { cwd: WORK_DIR, stdio: ['pipe', 'pipe', 'pipe'], env });
      session.proc = proc;
      proc.stdin.end();

      let assistantText = '';

      const rl = createInterface({ input: proc.stdout });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        let obj;
        try { obj = JSON.parse(line); } catch { return; }

        if (!session.claudeSessionId && obj.session_id) {
          session.claudeSessionId = obj.session_id;
        }

        switch (obj.type) {
          case 'assistant':
            for (const block of (obj.message?.content || [])) {
              if (block.type === 'thinking' && block.thinking) {
                send({ type: 'thinking', text: block.thinking });
              } else if (block.type === 'text' && block.text) {
                assistantText += block.text;
                send({ type: 'assistant', text: block.text });
              } else if (block.type === 'tool_use') {
                send({ type: 'tool_use', name: block.name, input: JSON.stringify(block.input) });
              }
            }
            break;
          case 'result':
            if (assistantText) pushHistory(session, 'assistant', assistantText);
            assistantText = '';
            // 更新会话名（取用户第一条消息前10字）
            if (session.history.length === 2 && session.name.startsWith('会话')) {
              session.name = prompt.slice(0, 15) + (prompt.length > 15 ? '...' : '');
              send({ type: 'sessions_updated', sessions: [...sessions.values()].map(sessionSummary), activeId: activeSessionId });
            }
            send({ type: 'status', text: 'done' });
            break;
        }
      });

      proc.stderr.on('data', d => console.error('[stderr]', d.toString().slice(0, 200)));
      proc.on('exit', (code) => {
        session.proc = null;
        if (code !== 0 && code !== null) send({ type: 'status', text: 'error' });
      });
      return;
    }

    if (msg.type === 'cancel') {
      const session = sessions.get(activeSessionId);
      if (session?.proc) { try { session.proc.kill('SIGTERM'); } catch {} session.proc = null; }
      send({ type: 'status', text: 'cancelled' });
      return;
    }

    // ── 执行 shell 命令 ──
    if (msg.type === 'shell') {
      const cmd = (msg.cmd || '').trim();
      if (!cmd) return;
      const shellId = randomBytes(4).toString('hex');
      send({ type: 'shell_start', shellId, cmd });

      const proc = spawn('bash', ['-c', cmd], { cwd: WORK_DIR, env: process.env });

      proc.stdout.on('data', d => send({ type: 'shell_out', shellId, data: d.toString() }));
      proc.stderr.on('data', d => send({ type: 'shell_out', shellId, data: d.toString(), stderr: true }));
      proc.on('exit', (code) => send({ type: 'shell_done', shellId, code }));
      proc.on('error', (err) => send({ type: 'shell_done', shellId, code: -1, error: err.message }));
      return;
    }
  });

  ws.on('close', () => {
    // 不杀进程，允许后台继续跑
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] http://127.0.0.1:${PORT}`);
});
