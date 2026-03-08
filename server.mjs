#!/usr/bin/env node
// remote-terminal-gui: Chat UI backed by claude -p stream-json
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn, execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || 8080);
const WORK_DIR = process.env.WORK_DIR || process.env.HOME;

// resolve claude binary
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
  try {
    return execFileSync('which', ['claude'], { encoding: 'utf8' }).trim();
  } catch {
    return 'claude';
  }
}
const CLAUDE_BIN = resolveClaude();
console.log(`[server] claude: ${CLAUDE_BIN}`);
console.log(`[server] workdir: ${WORK_DIR}`);

// HTTP
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(html);
  }
  res.writeHead(404); res.end('Not Found');
});

// WebSocket
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/ws') {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  console.log('[ws] connected');
  let currentProc = null;
  let claudeSessionId = null;

  function send(obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'send') {
      const prompt = (msg.text || '').trim();
      if (!prompt) return;

      if (currentProc) {
        try { currentProc.kill('SIGTERM'); } catch {}
        currentProc = null;
      }

      send({ type: 'status', text: 'thinking' });

      const args = [
        '-p', prompt,
        '--output-format', 'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
      ];
      if (claudeSessionId) args.push('--resume', claudeSessionId);

      const env = { ...process.env };
      delete env.CLAUDECODE;
      delete env.CLAUDE_CODE_ENTRYPOINT;

      const proc = spawn(CLAUDE_BIN, args, {
        cwd: WORK_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
      currentProc = proc;
      proc.stdin.end();

      const rl = createInterface({ input: proc.stdout });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        let obj;
        try { obj = JSON.parse(line); } catch { return; }

        if (!claudeSessionId && obj.session_id) {
          claudeSessionId = obj.session_id;
        }

        switch (obj.type) {
          case 'assistant': {
            for (const block of (obj.message?.content || [])) {
              if (block.type === 'text' && block.text) {
                send({ type: 'assistant', text: block.text });
              } else if (block.type === 'tool_use') {
                send({ type: 'tool_use', name: block.name, input: JSON.stringify(block.input) });
              }
            }
            break;
          }
          case 'result':
            send({ type: 'status', text: 'done' });
            break;
        }
      });

      proc.stderr.on('data', d => console.error('[stderr]', d.toString().slice(0, 200)));
      proc.on('exit', (code) => {
        currentProc = null;
        if (code !== 0) send({ type: 'status', text: 'error' });
      });

    } else if (msg.type === 'cancel') {
      if (currentProc) {
        try { currentProc.kill('SIGTERM'); } catch {}
        currentProc = null;
        send({ type: 'status', text: 'cancelled' });
      }
    } else if (msg.type === 'reset') {
      claudeSessionId = null;
      if (currentProc) {
        try { currentProc.kill('SIGTERM'); } catch {}
        currentProc = null;
      }
      send({ type: 'status', text: 'reset' });
    }
  });

  ws.on('close', () => {
    if (currentProc) try { currentProc.kill('SIGTERM'); } catch {}
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] http://127.0.0.1:${PORT}`);
});
