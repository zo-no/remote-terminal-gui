# nocode-deploy 🚀

通过美团 NoCode 平台（nocode.cn）一键部署 Web 页面。

## 特点

- 🤖 对话式创建：描述你要什么，NoCode AI 自动生成
- 🔗 固定链接：部署后获得可分享的固定 URL
- 📱 移动端友好：NoCode 生成的页面自动适配
- 🏢 内网可用：不依赖外网隧道

## 安装

```bash
# 1. 安装依赖
pip install websocket-client

# 2. 启动 Chrome（带远程调试）
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &

# Linux
google-chrome --remote-debugging-port=9222 &

# Windows
chrome.exe --remote-debugging-port=9222
```

## 使用

### 1. 首次登录

```bash
python3 nocode_browser.py login
```

会打开 nocode.cn 登录页，用美团 APP 或微信扫码。登录后 Cookie 会保存。

### 2. 部署页面

```bash
python3 nocode_browser.py deploy \
  --prompt "创建一个北京天气展示页面，展示最近5天天气，包含：
    - 今日天气卡片（大温度显示、天气图标）
    - 温度趋势折线图（高温红线、低温蓝线）
    - 5日预报列表（日期、天气、温度）
    - 深色模式支持" \
  --name "北京天气"
```

### 3. 检查状态

```bash
python3 nocode_browser.py status
```

## 输出

部署成功后会输出：
- 📎 固定访问链接
- 📋 部署信息 JSON（保存在 `/tmp/agent-webui/`）

## 对比 web-service-kit

| | web-service-kit | nocode-deploy |
|--|----------------|---------------|
| 部署方式 | Cloudflare 隧道 | 美团 NoCode |
| 链接稳定性 | 一次性随机 | 固定可分享 |
| 自定义程度 | 完全自由 | AI 生成 |
| 外网依赖 | 需要 | 不需要 |
| 适用场景 | 高度定制 | 快速原型 |

## 限制

- 首次需要手动扫码登录
- 生成质量取决于 prompt 描述
- NoCode 服务可用性依赖美团

## License

MIT
