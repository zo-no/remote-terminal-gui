---
name: remote-terminal
description: 启动远程终端服务，生成可在手机/远程设备访问的链接。支持 Claude 对话和 Shell 命令执行。当用户说"开远程终端"、"帮我启动 remote terminal"、"我要远程访问"时触发。
argument-hint: "[start|stop]"
allowed-tools: Bash
---

执行 `$ARGUMENTS` 操作（默认为 start）。

项目根目录（skill 目录即项目目录）：
```bash
PROJECT_DIR="${CLAUDE_SKILL_DIR}"
```

## start（启动）

### 1. 安装依赖（首次使用）

```bash
PROJECT_DIR="${CLAUDE_SKILL_DIR}"

# 安装 npm 依赖
[ ! -d "$PROJECT_DIR/node_modules" ] && cd "$PROJECT_DIR" && npm install

# 检查并安装 cloudflared
if ! command -v cloudflared &>/dev/null; then
  if [[ "$(uname)" == "Darwin" ]]; then
    brew install cloudflared
  else
    curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
    sudo apt update && sudo apt install -y cloudflared
  fi
fi
```

### 2. 检查是否已在运行

```bash
if [ -f /tmp/remote-terminal-gui.pid ] && kill -0 $(cat /tmp/remote-terminal-gui.pid 2>/dev/null | awk '{print $1}') 2>/dev/null; then
  echo "already_running"
  grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/remote-terminal-gui-tunnel.log 2>/dev/null | tail -1
fi
```

如果输出 `already_running` 且有 URL，直接跳到第 4 步返回结果。

### 3. 启动服务

```bash
bash "${CLAUDE_SKILL_DIR}/start.sh"
```

成功时输出包含完整访问链接（含 token）。如果报"Server 启动失败"，查看 `/tmp/remote-terminal-gui.log`。

### 4. 返回结果

提取输出中的完整 URL（格式：`https://xxxx.trycloudflare.com?token=xxxx`），告知用户：

> 远程终端已就绪，在手机或远程设备上打开：
>
> `https://xxxx.trycloudflare.com?token=xxxx`
>
> - **对话** Tab：与本机 Claude 对话
> - **终端** Tab：执行 shell 命令，含 openclaw / git 快捷按钮

## stop（停止）

```bash
bash "${CLAUDE_SKILL_DIR}/stop.sh"
```

## 依赖

| 依赖 | macOS | Linux |
|------|-------|-------|
| `node` | `brew install node` 或 nvm | `apt install nodejs` 或 nvm |
| `cloudflared` | `brew install cloudflared` | 见上方安装脚本 |
| `claude` | `npm install -g @anthropic-ai/claude-code` | 同左 |
