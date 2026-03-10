#!/usr/bin/env python3
"""
NoCode Deploy - 通过浏览器自动化在美团 NoCode 平台部署 Web 页面
用法:
  python3 nocode_browser.py login          # 登录（弹出扫码）
  python3 nocode_browser.py deploy --prompt "..." --name "项目名"
  python3 nocode_browser.py status         # 检查登录状态
"""

import json
import sys
import time
import argparse
import urllib.request

try:
    import websocket
except ImportError:
    print("请先安装 websocket-client: pip install websocket-client")
    sys.exit(1)

NOCODE_URL = "https://nocode.cn"
CDP_URL = "http://127.0.0.1:9222"


def get_ws():
    """获取 Chrome CDP WebSocket 连接"""
    try:
        resp = json.loads(urllib.request.urlopen(f"{CDP_URL}/json", timeout=5).read())
        ws_url = resp[0]["webSocketDebuggerUrl"]
        return websocket.create_connection(ws_url, timeout=30)
    except Exception as e:
        print(f"❌ 无法连接浏览器 CDP: {e}")
        print("请确保 Chrome 已启动并开启 remote-debugging-port=9222")
        sys.exit(1)


def evaluate(ws, expr, await_promise=False):
    """执行 JS 表达式"""
    params = {"expression": expr, "returnByValue": True}
    if await_promise:
        params["awaitPromise"] = True
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": params}))
    result = json.loads(ws.recv())
    return result.get("result", {}).get("result", {}).get("value", "")


def navigate(ws, url):
    """导航到 URL"""
    ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": url}}))
    json.loads(ws.recv())


def screenshot(ws, path="/tmp/nocode_screenshot.png"):
    """截图"""
    ws.send(json.dumps({"id": 1, "method": "Page.captureScreenshot", "params": {"format": "png"}}))
    result = json.loads(ws.recv())
    data = result.get("result", {}).get("data", "")
    if data:
        import base64
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        print(f"📸 截图已保存: {path}")


def cmd_status(args):
    """检查登录状态"""
    ws = get_ws()
    navigate(ws, NOCODE_URL)
    time.sleep(5)

    # 检查是否已登录
    logged_in = evaluate(ws, """
    (function() {
        var el = document.querySelector('[class*="avatar"], [class*="user"], [class*="profile"]');
        if (el) return 'logged_in';
        var loginBtn = document.querySelectorAll('*');
        for (var b of loginBtn) {
            if ((b.innerText||'').trim() === '登录') return 'not_logged_in';
        }
        return 'unknown';
    })()
    """)
    
    title = evaluate(ws, "document.title")
    url = evaluate(ws, "window.location.href")
    
    print(f"📄 页面: {title}")
    print(f"🔗 URL: {url}")
    print(f"🔐 状态: {logged_in}")
    ws.close()


def cmd_login(args):
    """登录 NoCode"""
    ws = get_ws()
    navigate(ws, NOCODE_URL)
    time.sleep(5)

    # 点击登录按钮
    result = evaluate(ws, """
    (function() {
        var all = document.querySelectorAll('*');
        for (var el of all) {
            var txt = (el.innerText||'').trim();
            if (txt === '登录' && el.getBoundingClientRect().width > 0) {
                el.click();
                return 'clicked';
            }
        }
        return 'no login button';
    })()
    """)
    print(f"🔐 登录按钮: {result}")
    
    time.sleep(3)
    screenshot(ws, "/tmp/nocode_login_qr.png")
    print("📱 请用美团APP或微信扫码登录")
    print("   截图路径: /tmp/nocode_login_qr.png")
    
    # 等待登录完成（最多 120 秒）
    print("⏳ 等待扫码...")
    for i in range(60):
        time.sleep(2)
        url = evaluate(ws, "window.location.href")
        logged = evaluate(ws, """
        (function() {
            var loginBtn = document.querySelectorAll('*');
            for (var b of loginBtn) {
                if ((b.innerText||'').trim() === '登录') return false;
            }
            return true;
        })()
        """)
        if logged == True or "dashboard" in url or "workspace" in url:
            print("✅ 登录成功！")
            ws.close()
            return
    
    print("❌ 登录超时")
    ws.close()


def cmd_deploy(args):
    """创建并部署项目"""
    prompt = args.prompt
    name = args.name or "Agent 生成页面"
    
    if not prompt:
        print("❌ 请提供 --prompt 参数")
        sys.exit(1)
    
    ws = get_ws()
    navigate(ws, NOCODE_URL)
    time.sleep(5)
    
    # 检查是否已登录
    title = evaluate(ws, "document.title")
    print(f"📄 当前页面: {title}")
    
    # 找到输入框并输入 prompt
    result = evaluate(ws, f"""
    (function() {{
        // 找到输入框（"使用 NoCode 创建..."）
        var textareas = document.querySelectorAll('textarea, [contenteditable=true], input[type=text]');
        for (var t of textareas) {{
            var ph = t.getAttribute('placeholder') || '';
            if (ph.includes('NoCode') || ph.includes('创建') || ph.includes('对话')) {{
                t.focus();
                t.value = {json.dumps(prompt)};
                t.dispatchEvent(new Event('input', {{bubbles: true}}));
                return 'input filled: ' + ph;
            }}
        }}
        return 'no input found';
    }})()
    """)
    print(f"📝 输入框: {result}")
    
    time.sleep(1)
    
    # 点击发送按钮
    result = evaluate(ws, """
    (function() {
        // 找发送按钮（通常是一个圆形上箭头）
        var btns = document.querySelectorAll('button, [role=button]');
        for (var b of btns) {
            var rect = b.getBoundingClientRect();
            // 发送按钮通常在输入框右侧
            if (rect.width > 20 && rect.width < 60 && rect.height > 20 && rect.height < 60) {
                var svg = b.querySelector('svg');
                if (svg) {
                    b.click();
                    return 'clicked send button';
                }
            }
        }
        // 也试试 Enter 键
        return 'no send button, try enter';
    })()
    """)
    print(f"📤 发送: {result}")
    
    if "try enter" in result:
        # 模拟 Enter 键
        ws.send(json.dumps({
            "id": 2,
            "method": "Input.dispatchKeyEvent",
            "params": {"type": "keyDown", "key": "Enter", "code": "Enter"}
        }))
        json.loads(ws.recv())
    
    print("⏳ 等待 NoCode 生成页面...")
    
    # 等待生成完成（观察页面变化）
    for i in range(60):
        time.sleep(5)
        url = evaluate(ws, "window.location.href")
        print(f"  [{i*5}s] URL: {url}")
        
        # 如果跳转到了项目编辑页面
        if "/project/" in url or "/edit/" in url or "/workspace/" in url:
            print("✅ 页面生成完成！")
            break
    
    # 截图当前状态
    screenshot(ws, "/tmp/nocode_generated.png")
    
    # 尝试找到部署/发布按钮
    result = evaluate(ws, """
    (function() {
        var btns = document.querySelectorAll('button, [role=button], a');
        var found = [];
        for (var b of btns) {
            var txt = (b.innerText||'').trim();
            if (txt.includes('部署') || txt.includes('发布') || txt.includes('Deploy') || txt.includes('Publish')) {
                found.push(txt);
                b.click();
                return 'clicked: ' + txt;
            }
        }
        return 'deploy buttons not found. available: ' + found.join(', ');
    })()
    """)
    print(f"🚀 部署: {result}")
    
    time.sleep(5)
    
    # 获取部署链接
    deploy_url = evaluate(ws, """
    (function() {
        // 查找包含 nocode.cn 的链接
        var links = document.querySelectorAll('a, input, [class*=url], [class*=link]');
        for (var l of links) {
            var href = l.href || l.value || l.innerText || '';
            if (href.includes('nocode.cn/') && href.includes('/share')) {
                return href;
            }
        }
        return window.location.href;
    })()
    """)
    
    print(f"\n{'='*50}")
    print(f"  🌐 项目名: {name}")
    print(f"  🔗 链接: {deploy_url}")
    print(f"{'='*50}")
    
    # 保存部署信息
    deploy_info = {
        "name": name,
        "prompt": prompt,
        "url": deploy_url,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "status": "deployed"
    }
    
    info_path = f"/tmp/agent-webui/nocode-{name.replace(' ', '-')}.json"
    import os
    os.makedirs(os.path.dirname(info_path), exist_ok=True)
    with open(info_path, "w") as f:
        json.dump(deploy_info, f, ensure_ascii=False, indent=2)
    print(f"📋 部署信息: {info_path}")
    
    ws.close()


def main():
    parser = argparse.ArgumentParser(description="NoCode Deploy - 美团 NoCode 浏览器自动化部署")
    sub = parser.add_subparsers(dest="command")
    
    sub.add_parser("status", help="检查登录状态")
    sub.add_parser("login", help="登录 NoCode")
    
    deploy_parser = sub.add_parser("deploy", help="创建并部署项目")
    deploy_parser.add_argument("--prompt", "-p", required=True, help="页面需求描述")
    deploy_parser.add_argument("--name", "-n", default="Agent Page", help="项目名称")
    
    args = parser.parse_args()
    
    if args.command == "status":
        cmd_status(args)
    elif args.command == "login":
        cmd_login(args)
    elif args.command == "deploy":
        cmd_deploy(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
