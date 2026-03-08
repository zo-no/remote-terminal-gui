# OpenClaw 远程修复 Skill 需求文档

## 背景

OpenClaw 部署在用户自己的服务器上，偶尔会挂掉需要远程修复。
用户希望通过一个 Skill（交给 OpenClaw Agent 执行），让 Agent 自动在本地拉起一个带 GUI 的远程 terminal，
用户点击页面上的按钮即可执行修复命令，无需 SSH。

## 目标

Agent 执行此 Skill 后：
1. 在本地启动一个 Web 服务（端口不与 OpenClaw 冲突）
2. 通过 Cloudflare 快速隧道暴露到公网
3. 输出访问链接给用户
4. 用户打开链接，看到带快捷按钮的 terminal 页面
5. 点击按钮执行 OpenClaw 修复命令

## 修复命令（两个）

- `openclaw doctor` — 诊断并自动修复
- `openclaw restart` — 强制重启服务

## 技术要求

- 端口：默认 9090（避开 OpenClaw 常用端口）
- 依赖：ttyd、cloudflared、node（需在文档中说明安装方式）
- 无需登录，打开即用
- 支持 Linux（服务器主要系统）
- Skill 格式：shell 脚本，Agent 可直接执行

## 交付物

- `skills/openclaw-repair.sh` — 主脚本
- `skills/openclaw-repair.html` — 定制 GUI（只有两个大按钮 + terminal）
- 本文档

## GUI 页面设计

```
┌─────────────────────────────────┐
│  OpenClaw 远程修复               │
│  状态: ● 已连接                  │
├─────────────────────────────────┤
│  [ openclaw doctor  ]           │
│  [ openclaw restart ]           │
├─────────────────────────────────┤
│                                 │
│  $ _                            │  ← terminal
│                                 │
└─────────────────────────────────┘
```

## 与 remote-terminal 的关系

复用 remote-terminal 的核心架构（ttyd + cloudflared + WebSocket 代理），
仅替换 GUI 页面和快捷按钮内容。
