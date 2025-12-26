
#!/usr/bin/env python3
"""
Minimal MCP server example that exposes a few safe tools and an "execute_python" tool.

This file is a near-copy of the user's reference with a small adjustment:
- default working directory is the repo root (one level up from this file) to be safer and portable.

Usage (local):
  python server/mcp_server.py

Notes:
 - This assumes a Python package providing `mcp.server.fastmcp.FastMCP` is available in the environment.
 - Logging goes to stderr (required).
 - The execute_python tool writes a temporary .py file and runs it in a subprocess. It is intentionally
   unsafe and should only be used in trusted/test environments.
"""
import os
import sys
import logging
import tempfile
import subprocess
from typing import List
import time



try:
    from mcp.server.fastmcp import FastMCP, Context
    from mcp.server.session import ServerSession
except Exception:
    # If the mcp package isn't available, provide helpful error when running the script.
    FastMCP = None  # type: ignore
    Context = None  # type: ignore
    ServerSession = None  # type: ignore

# Ensure logs go to stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("mcp_server")

# Default working directory: repo root (one level up from this file)
DEFAULT_CWD = os.path.abspath(os.path.join(os.path.dirname(__file__), "."))

if FastMCP is not None:
    mcp = FastMCP("cherry-stdio-demo")
else:
    mcp = None

# White-listed commands (example)
ALLOWED_COMMANDS = {
    "uptime": ["/usr/bin/uptime", "uptime"],
    "date": ["/bin/date", "date"],
    "ps": ["/bin/ps", "ps"],
    "zip": ["/usr/bin/zip", "zip"],
}


@mcp.tool() if mcp else (lambda f: f)
def change_cwd(path: str = DEFAULT_CWD) -> str:
    """Change current working directory for the process (dangerous). Returns status string."""
    logger.info("change_cwd called: %s", path)
    try:
        os.chdir(path)
        return f"OK: cwd changed to {os.getcwd()}"
    except Exception as e:
        logger.exception("change_cwd failed")
        return f"ERROR: {e}"



@mcp.tool() if mcp else (lambda f: f)
def list_dir(path: str = ".") -> str:
    """List directory contents in detailed, time-sorted format (newest last).
    Shows size, date, and marks directories with '/'.
    'total' indicates the number of entries (files + directories).
    """
    logger.info("list_dir called for %s", path)
    try:
        abs_path = os.path.abspath(path)
        if not os.path.exists(abs_path):
            return f"ERROR: path does not exist: {path}"
        if not os.path.isdir(abs_path):
            return f"ERROR: not a directory: {path}"

        entries = []

        for name in os.listdir(abs_path):
            full_path = os.path.join(abs_path, name)
            try:
                stat = os.stat(full_path)
                is_dir = os.path.isdir(full_path)
                size = stat.st_size
                mtime = stat.st_mtime

                # Format size: B, K, M, G
                if size >= 1024 * 1024 * 1024:
                    size_str = f"{size / (1024*1024*1024):.1f}G"
                elif size >= 1024 * 1024:
                    size_str = f"{size / (1024*1024):.1f}M"
                elif size >= 1024:
                    size_str = f"{size / 1024:.0f}K"
                else:
                    size_str = f"{size}B"

                # Format time: 'M D HH:MM' (e.g., "8 17 17:57")
                time_str = time.strftime("%m %d %H:%M", time.localtime(mtime))

                # Add '/' for directories
                display_name = name + "/" if is_dir else name

                entries.append({
                    "name": display_name,
                    "size_str": size_str,
                    "time_str": time_str,
                    "mtime": mtime,
                })
            except Exception as e:
                logger.warning("Cannot stat %s: %s", name, e)

        # Sort by modification time: oldest first (newest at the end)
        entries.sort(key=lambda x: x["mtime"])

        # Now: total = number of entries (files + directories)
        total_count = len(entries)

        # Format output
        lines = [f"total {total_count}"]
        for entry in entries:
            line = f"{entry['size_str']:>6}  {entry['time_str']}  {entry['name']}"
            lines.append(line)

        return "\n".join(lines)

    except Exception as e:
        logger.exception("list_dir failed")
        return f"ERROR: {e}"

@mcp.tool() if mcp else (lambda f: f)
def read_file(path: str) -> str:
    """Read text file contents (use only with trusted paths)."""
    logger.info("read_file called for %s", path)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.exception("read_file failed")
        return f"ERROR: {e}"


@mcp.tool() if mcp else (lambda f: f)
def write_file(path: str, content: str) -> str:
    """Write file (overwrite). Prevent writing to filesystem root."""
    logger.info("write_file called for %s", path)
    try:
        if os.path.abspath(path) == "/":
            return "ERROR: writing to root is not allowed"
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return "OK"
    except Exception as e:
        logger.exception("write_file failed")
        return f"ERROR: {e}"


@mcp.tool() if mcp else (lambda f: f)
def run_allowed(command_name: str) -> str:
    """Run a whitelisted command by name."""
    logger.info("run_allowed called: %s", command_name)
    try:
        if command_name not in ALLOWED_COMMANDS:
            return f"ERROR: command '{command_name}' not allowed"
        cmd = ALLOWED_COMMANDS[command_name]
        cp = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        out = cp.stdout.strip()
        err = cp.stderr.strip()
        if cp.returncode != 0:
            return f"ERROR (rc={cp.returncode}): {err or out}"
        return out or "(no output)"
    except Exception as e:
        logger.exception("run_allowed failed")
        return f"ERROR: {e}"


# WARNING: execute_python is intentionally unsafe. Only use in test/trusted envs.
@mcp.tool() if mcp else (lambda f: f)
def execute_python(code: str, timeout: int = 5, cwd: str | None = DEFAULT_CWD) -> str:
    """
    Execute provided Python code in a subprocess and return stdout/stderr and return code.
    This makes no attempt to sandbox execution.
    """
    logger.info("execute_python called (len=%d) cwd=%s", len(code), cwd)
    fd, path = tempfile.mkstemp(suffix=".py", prefix="mcp_exec_")
    os.close(fd)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)

        proc = subprocess.run(
            [sys.executable, "-u", path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        out = proc.stdout or ""
        err = proc.stderr or ""
        rc = proc.returncode
        return f"RC={rc}\n--- stdout ---\n{out}\n--- stderr ---\n{err}"
    except subprocess.TimeoutExpired:
        return "ERROR: timeout"
    except Exception as e:
        logger.exception("execute_python failed")
        return f"ERROR: {e}"
    finally:
        try:
            os.remove(path)
        except Exception:
            pass


# New tool: save_script
@mcp.tool() if mcp else (lambda f: f)
def save_script(filename: str, code: str) -> str:
    """
    Save the provided code into DEFAULT_CWD/saved_scripts/<filename>.py
    filename must be a simple basename (no slashes, no ..).
    """
    logger.info("save_script called: %s", filename)
    try:
        if not filename:
            return "ERROR: filename required"
        # simple filename check: no path components, no traversal
        if os.path.basename(filename) != filename or ".." in filename:
            return "ERROR: filename must be a simple basename without path separators"
        if not filename.endswith(".py"):
            filename = filename + ".py"
        scripts_dir = os.path.abspath(os.path.join(DEFAULT_CWD, "saved_scripts"))
        os.makedirs(scripts_dir, exist_ok=True)
        target = os.path.abspath(os.path.join(scripts_dir, filename))
        # ensure target is inside scripts_dir
        if os.path.commonpath([scripts_dir, target]) != scripts_dir:
            return "ERROR: invalid filename"
        with open(target, "w", encoding="utf-8") as f:
            f.write(code)
        return f"OK: saved to {target}"
    except Exception as e:
        logger.exception("save_script failed")
        return f"ERROR: {e}"


# New tool: exe_script
@mcp.tool() if mcp else (lambda f: f)
def exe_script(filename: str, timeout: int = 5) -> str:
    """
    Execute a previously saved script from DEFAULT_CWD/saved_scripts/<filename>.
    Returns output or error (strings).
    """
    logger.info("exe_script called: %s", filename)
    try:
        if not filename:
            return "ERROR: filename required"
        if os.path.basename(filename) != filename or ".." in filename:
            return "ERROR: filename must be a simple basename without path separators"
        if not filename.endswith(".py"):
            filename = filename + ".py"
        scripts_dir = os.path.abspath(os.path.join(DEFAULT_CWD, "saved_scripts"))
        target = os.path.abspath(os.path.join(scripts_dir, filename))
        if os.path.commonpath([scripts_dir, target]) != scripts_dir:
            return "ERROR: invalid filename"
        if not os.path.exists(target):
            return f"ERROR: file not found: {filename}"
        cp = subprocess.run([sys.executable, "-u", target], capture_output=True, text=True, timeout=timeout, cwd=scripts_dir)
        out = cp.stdout or ""
        err = cp.stderr or ""
        rc = cp.returncode
        if rc != 0:
            return f"ERROR (rc={rc}): {err or out}"
        return out or "(no output)"
    except subprocess.TimeoutExpired:
        return "ERROR: timeout"
    except Exception as e:
        logger.exception("exe_script failed")
        return f"ERROR: {e}"


@mcp.tool() if mcp else (lambda f: f)
def autopep8(filename: str) -> str:
    """
    Format a Python script using autopep8.
    Input: filename (relative to DEFAULT_CWD or absolute).
    Returns stdout of autopep8 or error.
    """
    logger.info("autopep8 called: %s", filename)
    try:
        if not filename:
            return "ERROR: filename required"
        # Validate path to avoid traversal
        filepath = os.path.abspath(os.path.join(DEFAULT_CWD, filename))
        scripts_dir = os.path.abspath(DEFAULT_CWD)
        if os.path.commonpath([scripts_dir, filepath]) != scripts_dir:
            return "ERROR: file not within allowed directory"
        if not os.path.exists(filepath):
            return f"ERROR: file not found: {filename}"

        # Run autopep8 --in-place
        result = subprocess.run(
            ["autopep8", "--in-place", filepath],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return f"ERROR: autopep8 failed: {result.stderr.strip()}"
        return f"OK: formatted {filename}"
    except subprocess.TimeoutExpired:
        return "ERROR: autopep8 timed out"
    except Exception as e:
        logger.exception("autopep8 failed")
        return f"ERROR: {e}"


@mcp.tool() if mcp else (lambda f: f)
def install(package: str) -> str:
    """
    Install a Python package using `uv pip install`.
    Input: package name (e.g., 'requests' or 'requests==2.28.0').
    """
    logger.info("install called: %s", package)
    if not package:
        return "ERROR: package name required"
    try:
        result = subprocess.run(
            ["uv", "pip", "install", package],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            return f"ERROR: uv install failed: {stderr[:500]}"  # limit output
        return f"OK: installed {package}"
    except subprocess.TimeoutExpired:
        return "ERROR: install timed out"
    except Exception as e:
        logger.exception("install failed")
        return f"ERROR: {e}"



@mcp.tool() if mcp else (lambda f: f)
async def long_task(ctx, steps: int = 5) -> str:
    # In environments without the mcp package, Context may not be available.
    # Accept a generic ctx and attempt to call report_progress if present.
    logger.info("long_task start steps=%s", steps)
    for i in range(steps):
        try:
            await ctx.report_progress(progress=(i + 1) / steps, total=1.0, message=f"step {i+1}/{steps}")
        except Exception:
            # Fallback: sleep briefly to simulate work
            import asyncio

            await asyncio.sleep(0.01)
    return "done"


if __name__ == "__main__":
    if FastMCP is None:
        # Provide a lightweight fallback HTTP SSE server so integration tests can run
        # without the external mcp package. It accepts POST JSON { messages: [...] }
        # and streams a few `data: {...}\n\n` chunks echoing back message content.
        from http.server import BaseHTTPRequestHandler, HTTPServer
        import threading
        import json
        import time

        class SimpleSseHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                """Handle GET requests for tool listing"""
                logger.info("SimpleSseHandler GET path=%s", getattr(self, 'path', None))
                
                # Return list of available tools
                if self.path in ['/tools', '/tools/list', '/tools/']:
                    tools = [
                        {"name": "execute_python", "description": "Execute Python code in a subprocess", "inputSchema": {"type": "object", "properties": {"code": {"type": "string"}, "timeout": {"type": "integer"}, "cwd": {"type": "string"}}}},
                        {"name": "install", "description": "Install a Python package using uv pip install", "inputSchema": {"type": "object", "properties": {"package": {"type": "string"}}}},
                        {"name": "list_dir", "description": "List directory contents", "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}}},
                        {"name": "read_file", "description": "Read file contents", "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}}},
                        {"name": "write_file", "description": "Write content to file", "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}}},
                        {"name": "save_script", "description": "Save Python script to saved_scripts folder", "inputSchema": {"type": "object", "properties": {"filename": {"type": "string"}, "code": {"type": "string"}}}},
                        {"name": "exe_script", "description": "Execute a saved script", "inputSchema": {"type": "object", "properties": {"filename": {"type": "string"}, "timeout": {"type": "integer"}}}},
                        {"name": "autopep8", "description": "Format Python file with autopep8", "inputSchema": {"type": "object", "properties": {"filename": {"type": "string"}}}}
                    ]
                    resp = json.dumps({"tools": tools})
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(resp.encode('utf-8'))
                    return
                
                # Unknown GET path
                self.send_response(404)
                self.end_headers()

            def do_POST(self):
                logger.info("SimpleSseHandler POST path=%s", getattr(self, 'path', None))
                try:
                    # Log a few headers for debugging
                    hdrs = {k: self.headers.get(k) for k in ['Content-Type', 'Content-Length', 'User-Agent']}
                    logger.info("request headers: %s", hdrs)
                except Exception:
                    pass
                # Support a few JSON tool endpoints for tests when MCP package is missing:
                # - /tools/list_dir  -> returns application/json list of files
                # - /tools/execute_python -> accepts { code, timeout, cwd } and returns JSON { result }
                # - /tools/save_script -> accepts { filename, code } and returns JSON { result }
                # - /tools/exe_script  -> accepts { filename, timeout } and returns JSON { result }
                # - /tools/read_file   -> accepts { filename } and returns JSON { result }
                try:
                    length = int(self.headers.get('content-length', 0))
                    raw = self.rfile.read(length)
                    payload = json.loads(raw.decode('utf-8') or '{}')
                except Exception:
                    payload = {}

                
                if self.path == '/tools/autopep8':
                    filename = payload.get('filename') or payload.get('path')
                    try:
                        result = autopep8(filename)
                        resp = json.dumps({ 'ok': True, 'result': result })
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Cache-Control', 'no-cache')
                        self.end_headers()
                        self.wfile.write(resp.encode('utf-8'))
                        return
                    except Exception:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({ 'ok': False }).encode('utf-8'))
                        return

                if self.path == '/tools/install':
                    package = payload.get('package')
                    try:
                        result = install(package)
                        resp = json.dumps({ 'ok': True, 'result': result })
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Cache-Control', 'no-cache')
                        self.end_headers()
                        self.wfile.write(resp.encode('utf-8'))
                        return
                    except Exception:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({ 'ok': False }).encode('utf-8'))
                        return


                if self.path == '/tools/list_dir':
                    path = payload.get('path', '.')
                    try:
                        items = list_dir(path)
                        resp = json.dumps({ 'ok': True, 'items': items })
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Cache-Control', 'no-cache')
                        self.end_headers()
                        self.wfile.write(resp.encode('utf-8'))
                        return
                    except Exception:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({ 'ok': False }).encode('utf-8'))
                        return

                if self.path == '/tools/execute_python':
                    code = payload.get('code', '')
                    timeout_v = int(payload.get('timeout', 5))
                    cwd_v = payload.get('cwd', None) or None
                    try:
                        result = execute_python(code, timeout=timeout_v, cwd=cwd_v)
                        resp = json.dumps({ 'ok': True, 'result': result })
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Cache-Control', 'no-cache')
                        self.end_headers()
                        self.wfile.write(resp.encode('utf-8'))
                        return
                    except Exception:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({ 'ok': False }).encode('utf-8'))
                        return

                if self.path == '/tools/save_script':
                    filename = payload.get('filename') or payload.get('name')
                    code = payload.get('code', '')
                    try:
                        result = save_script(filename, code)
                        resp = json.dumps({ 'ok': True, 'result': result })
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Cache-Control', 'no-cache')
                        self.end_headers()
                        self.wfile.write(resp.encode('utf-8'))
                        return
                    except Exception:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({ 'ok': False }).encode('utf-8'))
                        return

                if self.path == '/tools/exe_script':
                    filename = payload.get('filename') or payload.get('name')
                    timeout_v = int(payload.get('timeout', 5))
                    try:
                        result = exe_script(filename, timeout=timeout_v)
                        resp = json.dumps({ 'ok': True, 'result': result })
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Cache-Control', 'no-cache')
                        self.end_headers()
                        self.wfile.write(resp.encode('utf-8'))
                        return
                    except Exception:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({ 'ok': False }).encode('utf-8'))
                        return

                if self.path == '/tools/read_file':
                    filename = payload.get('filename') or payload.get('path')
                    try:
                        result = read_file(filename)
                        resp = json.dumps({ 'ok': True, 'result': result })
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Cache-Control', 'no-cache')
                        self.end_headers()
                        self.wfile.write(resp.encode('utf-8'))
                        return
                    except Exception:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({ 'ok': False }).encode('utf-8'))
                        return

                # Fallback: original SSE-style echo behavior for POST with { messages: [...] }
                try:
                    messages = payload.get('messages', [])
                except Exception:
                    messages = []

                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self.end_headers()

                # Stream a short SSE-style sequence
                try:
                    for m in messages:
                        content = m.get('content') if isinstance(m, dict) else str(m)
                        data = json.dumps({ 'choices': [ { 'delta': { 'content': f"echo: {content}" } } ] })
                        self.wfile.write(f"data: {data}\n\n".encode('utf-8'))
                        self.wfile.flush()
                        time.sleep(0.02)
                    # final done
                    self.wfile.write(b"data: [DONE]\n\n")
                    self.wfile.flush()
                except BrokenPipeError:
                    pass

        def run_fallback_server(host='127.0.0.1', port=33333):
            server = HTTPServer((host, port), SimpleSseHandler)
            logger.info(f"MCP fallback server listening on http://{host}:{port}")
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                server.shutdown()

        thread = threading.Thread(target=run_fallback_server, daemon=True)
        thread.start()

        # Keep main thread alive until interrupted
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info('MCP fallback server stopping')
            sys.exit(0)
    else:
        # Run transport over stdio (demo)
        mcp.run(transport="stdio")
