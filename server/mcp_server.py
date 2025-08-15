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
DEFAULT_CWD = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

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
def list_dir(path: str = ".") -> List[str]:
    """List files in directory (returns list of names)."""
    logger.info("list_dir called for %s", path)
    try:
        items = os.listdir(path)
        return items
    except Exception as e:
        logger.exception("list_dir failed")
        return [f"ERROR: {e}"]


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
            def do_POST(self):
                logger.info("SimpleSseHandler POST path=%s", getattr(self, 'path', None))
                try:
                    # Log a few headers for debugging
                    hdrs = {k: self.headers.get(k) for k in ['Content-Type', 'Content-Length', 'User-Agent']}
                    logger.info("request headers: %s", hdrs)
                except Exception:
                    pass
                # Support two JSON tool endpoints for tests when MCP package is missing:
                # - /tools/list_dir  -> returns application/json list of files
                # - /tools/execute_python -> accepts { code, timeout, cwd } and returns JSON { result }
                try:
                    length = int(self.headers.get('content-length', 0))
                    raw = self.rfile.read(length)
                    payload = json.loads(raw.decode('utf-8') or '{}')
                except Exception:
                    payload = {}

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
