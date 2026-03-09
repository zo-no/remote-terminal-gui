---
name: heart-defibrillator
description: 心脏复苏器 - 远程执行 openclaw 修复命令。当用户说"心脏复苏"、"启动复苏器"、"openclaw 远程修复"时触发。
argument-hint: "[start|stop]"
allowed-tools: Bash
---

执行 `$ARGUMENTS` 操作（默认为 start）。

项目根目录：
```bash
PROJECT_DIR="/Users/kual/code/remote-terminal-gui/heart-defibrillator"
```

## start（启动）

### 1. 检查依赖

```bash
if ! command -v cloudflared &>/dev/null; then
  echo "缺少 cloudflared"
  exit 1
fi
```

### 2. 检查是否已在运行

```bash
if [ -f /tmp/heart-defibrillator.pid ] && kill -0 $(cat /tmp/heart-defibrillator.pid 2>/dev/null | awk '{print $1}') 2>/dev/null; then
  echo "already_running"
  grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/heart-defibrillator-tunnel.log 2>/dev/null | tail -1
fi
```

如果输出 `already_running`，直接返回已有 URL。

### 3. 启动服务

```bash
PROJECT_DIR="/Users/kual/code/remote-terminal-gui/heart-defibrillator"
bash "$PROJECT_DIR/start.sh"
```

成功后提取完整 URL 告知用户：

> ⚡ 心脏复苏器已就绪，在手机或远程设备打开：
>
> `https://xxx.trycloudflare.com?token=xxx`
>
> 预设命令：doctor / gateway restart / gateway status / list / logs / restart

## stop（停止）

```bash
PROJECT_DIR="/Users/kual/code/remote-terminal-gui/heart-defibrillator"
bash "$PROJECT_DIR/stop.sh"
```

## 快捷命令

| 命令 | 说明 |
|------|------|
| `openclaw doctor` | 诊断修复 |
| `openclaw gateway restart` | 重启网关 |
| `openclaw gateway status` | 网关状态 |
| `openclaw list` | 列出服务 |
| `openclaw logs --tail 50` | 查看日志 |
| `openclaw restart` | 重启服务 |
