#!/usr/bin/env node
// GUI server: 反向代理 ttyd + 提供自定义页面
// 所有 /terminal/* 请求转发给 ttyd，其余走自定义 HTML

import http from 'http';
import net from 'net';
import { createReadStream, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || 8080);
const TTYD_PORT = parseInt(process.env.TTYD_PORT || 7700);

// 反向代理 HTTP 请求到 ttyd
function proxyHttp(req, res, ttydPath) {
  const options = {
    hostname: '127.0.0.1',
    port: TTYD_PORT,
    path: ttydPath,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${TTYD_PORT}` },
  };
  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxy.on('error', () => { res.writeHead(502); res.end('ttyd unavailable'); });
  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // 主页：返回自定义 GUI
  if (url === '/' || url === '/index.html') {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
    return;
  }

  // /terminal → ttyd 根路径
  if (url === '/terminal' || url === '/terminal/') {
    proxyHttp(req, res, '/');
    return;
  }

  // 其余全部代理给 ttyd（静态资源、API 等）
  proxyHttp(req, res, url);
});

// WebSocket 代理：/ws → ttyd ws
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(TTYD_PORT, '127.0.0.1', () => {
    upstream.write(
      `GET ${req.url} HTTP/1.1\r\n` +
      `Host: 127.0.0.1:${TTYD_PORT}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${req.headers['sec-websocket-key']}\r\n` +
      `Sec-WebSocket-Version: ${req.headers['sec-websocket-version']}\r\n` +
      (req.headers['sec-websocket-protocol']
        ? `Sec-WebSocket-Protocol: ${req.headers['sec-websocket-protocol']}\r\n` : '') +
      `\r\n`
    );
    if (head && head.length) upstream.write(head);
  });
  upstream.on('data', d => socket.write(d));
  socket.on('data', d => upstream.write(d));
  upstream.on('end', () => socket.end());
  socket.on('end', () => upstream.end());
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`GUI server on http://127.0.0.1:${PORT} → ttyd :${TTYD_PORT}`);
});
