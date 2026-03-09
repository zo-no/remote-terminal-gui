# remote-terminal-gui

远程终端服务，支持 Claude 对话和 Shell 命令执行，移动端友好。

## 依赖

- node
- cloudflared (`brew install cloudflared`)

## 使用

```bash
./start.sh   # 启动，输出访问链接（含 token）
./stop.sh    # 停止
```

## Skill

通过 `/remote-terminal` 命令启动。Skill 定义在 `~/.claude/skills/remote-terminal/SKILL.md`。
