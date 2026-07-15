"""
os_agent.py — Computer Use backend (cua-driver MCP bridge)

Fixes applied:
  #1  Persistent MCP session singleton — eliminates per-request binary spawn overhead
  #2  cursor_position now parses and returns structured x/y coordinates
  #3  left_click with coordinate uses direct cursor move+click, no dummy-PID lookup
  #4  type / key use req.pid when caller provides it; fall back to focused-window PID
  #6  Screenshot probes multiple tool names (get_desktop_state → screenshot → capture_screen)
  #7  middle_click handler added
  #8  scroll action added (coordinate + direction + amount)
"""

import os
import io
import sys
import json
import shutil
import asyncio
import logging
from typing import Optional, List
from contextlib import AsyncExitStack

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ── MCP SDK ──────────────────────────────────────────────────────────────────
try:
    from mcp.client.stdio import stdio_client, StdioServerParameters
    from mcp import ClientSession
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False

router = APIRouter()


# ── Request model ─────────────────────────────────────────────────────────────
class ComputerUseRequest(BaseModel):
    action: str
    coordinate: Optional[List[int]] = None   # [x, y]
    text: Optional[str] = None               # text to type, key combo, scroll direction
    pid: Optional[int] = None
    window_id: Optional[int] = None
    element_index: Optional[int] = None
    amount: Optional[int] = None             # scroll amount (default 3)
    save_path: Optional[str] = None          # screenshot save path (handled by TS bridge)


# ── Fix #1: Persistent singleton MCP session ──────────────────────────────────
# Spawning cua-driver per request costs 300–800 ms of binary startup + MCP
# handshake. We keep one long-lived session inside the ML-engine process.
# If the session dies (cua-driver crash, OS sleep, etc.) we reconnect once.

_session_lock = asyncio.Lock()
_mcp_exit_stack: Optional[AsyncExitStack] = None
_mcp_session: Optional["ClientSession"] = None  # type: ignore


def _find_cua_driver() -> Optional[str]:
    """Locate the cua-driver binary."""
    candidates = [
        os.path.expanduser("~/.local/bin/cua-driver"),
        "/usr/local/bin/cua-driver",
        "/usr/bin/cua-driver",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return shutil.which("cua-driver")


async def _create_session() -> "ClientSession":
    """Spawn cua-driver and return a freshly initialised MCP session."""
    cua_bin = _find_cua_driver()
    if not cua_bin:
        raise RuntimeError("cua-driver binary not found. Install it or add it to PATH.")
    env = os.environ.copy()
    params = StdioServerParameters(command=cua_bin, args=["mcp"], env=env)
    stack = AsyncExitStack()
    read, write = await stack.enter_async_context(stdio_client(params))
    session = await stack.enter_async_context(ClientSession(read, write))
    await session.initialize()
    return session, stack


async def get_session() -> "ClientSession":
    """Return the shared MCP session, creating or reconnecting as needed."""
    global _mcp_session, _mcp_exit_stack
    async with _session_lock:
        if _mcp_session is not None:
            return _mcp_session
        logger.info("[ComputerUse] Creating persistent MCP session...")
        session, stack = await _create_session()
        _mcp_session = session
        _mcp_exit_stack = stack
        logger.info("[ComputerUse] Persistent MCP session ready.")
        return _mcp_session


async def reset_session():
    """Tear down and clear the cached session so the next call reconnects."""
    global _mcp_session, _mcp_exit_stack
    async with _session_lock:
        if _mcp_exit_stack is not None:
            try:
                await _mcp_exit_stack.aclose()
            except Exception:
                pass
        _mcp_session = None
        _mcp_exit_stack = None


async def call_tool(tool_name: str, args: dict) -> any:
    """
    Call a cua-driver MCP tool with automatic session recovery.
    On first failure, the session is reset and the call is retried once.
    """
    for attempt in range(2):
        try:
            session = await get_session()
            return await session.call_tool(tool_name, args)
        except Exception as e:
            if attempt == 0:
                logger.warning(f"[ComputerUse] Tool '{tool_name}' failed ({e}). Resetting session and retrying...")
                await reset_session()
            else:
                raise


# ── Fix #6: Screenshot with multi-tool fallback ───────────────────────────────
_SCREENSHOT_TOOLS = ["get_desktop_state", "screenshot", "capture_screen", "take_screenshot"]

async def take_screenshot() -> str:
    """
    Capture the desktop as a base64 PNG string.
    Probes known tool names in order; returns '' if all fail (silent degradation).
    """
    for tool_name in _SCREENSHOT_TOOLS:
        try:
            res = await call_tool(tool_name, {})
            if hasattr(res, "content"):
                for item in res.content:
                    if item.type == "image":
                        b64 = getattr(item, "data", "")
                        if b64:
                            return b64
                    elif item.type == "text":
                        try:
                            data = json.loads(item.text)
                            if "base64_image" in data and data["base64_image"]:
                                return data["base64_image"]
                        except Exception:
                            pass
        except Exception as e:
            logger.debug(f"[Screenshot] Tool '{tool_name}' not available: {e}")
    logger.warning("[ComputerUse] All screenshot tools failed — returning empty image.")
    return ""


# ── Fix #4: Focused-window PID helper (called only when pid not provided) ─────
async def get_focused_pid() -> int:
    """
    Return the PID of the currently focused / frontmost window.
    Falls back to the first user-space window, then to 1 as a last resort.
    This is only called when the caller did NOT supply req.pid.
    """
    try:
        res = await call_tool("get_accessibility_tree", {})
        if hasattr(res, "content"):
            for item in res.content:
                if item.type == "text":
                    data = json.loads(item.text)
                    # Prefer a "focused" flag if cua-driver exposes it
                    for w in data.get("windows", []):
                        if w.get("focused"):
                            return w.get("pid", 0)
                    # Fall back to first window
                    windows = data.get("windows", [])
                    if windows:
                        return windows[0].get("pid", 0)
                    processes = data.get("processes", [])
                    if processes:
                        return processes[-1].get("pid", 0)
    except Exception as e:
        logger.debug(f"[ComputerUse] get_focused_pid failed: {e}")
    return 1


# ── Main endpoint ─────────────────────────────────────────────────────────────
@router.post("/computer_use")
async def computer_use(req: ComputerUseRequest):
    if not MCP_AVAILABLE:
        raise HTTPException(status_code=500, detail="mcp python SDK is not installed. Run: pip install mcp")

    action = req.action
    result_text = ""
    b64_image = ""
    needs_screenshot = True  # Most actions auto-capture after execution

    try:
        # ── cursor_position (Fix #2) ──────────────────────────────────────────
        if action == "cursor_position":
            res = await call_tool("get_cursor_position", {})
            x, y = None, None
            if hasattr(res, "content"):
                for item in res.content:
                    if item.type == "text":
                        try:
                            data = json.loads(item.text)
                            x = data.get("x") or data.get("cursor_x")
                            y = data.get("y") or data.get("cursor_y")
                        except Exception:
                            # Raw text like "540 320" or "(540, 320)"
                            nums = [int(n) for n in item.text.split() if n.isdigit()]
                            if len(nums) >= 2:
                                x, y = nums[0], nums[1]
            if x is not None and y is not None:
                result_text = f"Cursor is at x={x}, y={y}"
            else:
                result_text = f"Cursor position retrieved (raw response stored)."
            needs_screenshot = False  # No need for screenshot here

        # ── screenshot ───────────────────────────────────────────────────────
        elif action == "screenshot":
            b64_image = await take_screenshot()
            result_text = "Screenshot captured."
            needs_screenshot = False  # Already captured above

        # ── mouse_move ───────────────────────────────────────────────────────
        elif action == "mouse_move":
            if not req.coordinate or len(req.coordinate) != 2:
                raise HTTPException(status_code=400, detail="coordinate [x, y] is required for mouse_move")
            await call_tool("move_cursor", {"x": req.coordinate[0], "y": req.coordinate[1]})
            result_text = f"Mouse moved to ({req.coordinate[0]}, {req.coordinate[1]})"

        # ── left_click (Fix #3) ──────────────────────────────────────────────
        elif action == "left_click":
            if req.element_index is not None and req.pid is not None and req.window_id is not None:
                # Precision element-tree click (most reliable)
                await call_tool("click", {
                    "pid": req.pid,
                    "window_id": req.window_id,
                    "element_index": req.element_index,
                })
                result_text = f"Left-clicked element #{req.element_index} in window {req.window_id}"
            elif req.coordinate and len(req.coordinate) == 2:
                # Coordinate-based click — move then click at current position
                # No need for a dummy PID lookup when we have explicit coordinates
                await call_tool("move_cursor", {"x": req.coordinate[0], "y": req.coordinate[1]})
                # Try clicking at cursor position; some drivers accept empty args
                try:
                    await call_tool("click", {})
                except Exception:
                    # Fallback: provide PID if required by this driver version
                    pid = req.pid if req.pid is not None else await get_focused_pid()
                    await call_tool("click", {"pid": pid})
                result_text = f"Left-clicked at ({req.coordinate[0]}, {req.coordinate[1]})"
            else:
                raise HTTPException(status_code=400, detail="Provide either (coordinate) or (element_index + pid + window_id) for left_click")

        # ── right_click ──────────────────────────────────────────────────────
        elif action == "right_click":
            if req.element_index is not None and req.pid is not None and req.window_id is not None:
                await call_tool("right_click", {
                    "pid": req.pid, "window_id": req.window_id, "element_index": req.element_index
                })
                result_text = f"Right-clicked element #{req.element_index}"
            elif req.coordinate and len(req.coordinate) == 2:
                await call_tool("move_cursor", {"x": req.coordinate[0], "y": req.coordinate[1]})
                try:
                    await call_tool("right_click", {})
                except Exception:
                    pid = req.pid if req.pid is not None else await get_focused_pid()
                    await call_tool("right_click", {"pid": pid})
                result_text = f"Right-clicked at ({req.coordinate[0]}, {req.coordinate[1]})"
            else:
                raise HTTPException(status_code=400, detail="Provide coordinate or element_index+pid+window_id for right_click")

        # ── middle_click (Fix #7) ────────────────────────────────────────────
        elif action == "middle_click":
            if req.element_index is not None and req.pid is not None and req.window_id is not None:
                await call_tool("middle_click", {
                    "pid": req.pid, "window_id": req.window_id, "element_index": req.element_index
                })
                result_text = f"Middle-clicked element #{req.element_index}"
            elif req.coordinate and len(req.coordinate) == 2:
                await call_tool("move_cursor", {"x": req.coordinate[0], "y": req.coordinate[1]})
                try:
                    await call_tool("middle_click", {})
                except Exception:
                    pid = req.pid if req.pid is not None else await get_focused_pid()
                    await call_tool("middle_click", {"pid": pid})
                result_text = f"Middle-clicked at ({req.coordinate[0]}, {req.coordinate[1]})"
            else:
                raise HTTPException(status_code=400, detail="Provide coordinate or element_index+pid+window_id for middle_click")

        # ── double_click ─────────────────────────────────────────────────────
        elif action == "double_click":
            if req.element_index is not None and req.pid is not None and req.window_id is not None:
                await call_tool("double_click", {
                    "pid": req.pid, "window_id": req.window_id, "element_index": req.element_index
                })
                result_text = f"Double-clicked element #{req.element_index}"
            elif req.coordinate and len(req.coordinate) == 2:
                await call_tool("move_cursor", {"x": req.coordinate[0], "y": req.coordinate[1]})
                try:
                    await call_tool("double_click", {})
                except Exception:
                    pid = req.pid if req.pid is not None else await get_focused_pid()
                    await call_tool("double_click", {"pid": pid})
                result_text = f"Double-clicked at ({req.coordinate[0]}, {req.coordinate[1]})"
            else:
                raise HTTPException(status_code=400, detail="Provide coordinate or element_index+pid+window_id for double_click")

        # ── left_click_drag ──────────────────────────────────────────────────
        elif action == "left_click_drag":
            if not req.coordinate or len(req.coordinate) != 2:
                raise HTTPException(status_code=400, detail="coordinate [x, y] (drag destination) is required")
            await call_tool("mouse_drag", {"x": req.coordinate[0], "y": req.coordinate[1]})
            result_text = f"Dragged to ({req.coordinate[0]}, {req.coordinate[1]})"

        # ── type (Fix #4) ────────────────────────────────────────────────────
        elif action == "type":
            if not req.text:
                raise HTTPException(status_code=400, detail="text is required for type action")
            # Use caller-supplied PID if available; avoid expensive accessibility tree call
            pid = req.pid if req.pid is not None else await get_focused_pid()
            await call_tool("type_text", {"pid": pid, "text": req.text})
            result_text = f"Typed: {req.text[:80]}{'...' if len(req.text) > 80 else ''}"

        # ── key (Fix #4) ─────────────────────────────────────────────────────
        elif action == "key":
            if not req.text:
                raise HTTPException(status_code=400, detail="text (key combo) is required for key action. e.g. 'ctrl+c', 'enter', 'escape'")
            pid = req.pid if req.pid is not None else await get_focused_pid()
            # Support both "ctrl+c" style and space-separated "ctrl c"
            keys = [k.strip() for k in req.text.replace("+", " ").split() if k.strip()]
            await call_tool("hotkey", {"pid": pid, "keys": keys})
            result_text = f"Pressed key(s): {req.text}"

        # ── scroll (Fix #8) ──────────────────────────────────────────────────
        elif action == "scroll":
            if not req.coordinate or len(req.coordinate) != 2:
                raise HTTPException(status_code=400, detail="coordinate [x, y] is required for scroll")
            direction = (req.text or "down").lower()
            if direction not in ("up", "down", "left", "right"):
                raise HTTPException(status_code=400, detail=f"scroll direction must be 'up', 'down', 'left', or 'right'. Got: '{direction}'")
            amount = req.amount if req.amount is not None else 3
            try:
                await call_tool("scroll", {
                    "x": req.coordinate[0],
                    "y": req.coordinate[1],
                    "direction": direction,
                    "amount": amount,
                })
            except Exception:
                # Fallback: simulate scroll via keyboard if cua-driver doesn't support scroll tool
                key_map = {"up": "page_up", "down": "page_down", "left": "left", "right": "right"}
                pid = req.pid if req.pid is not None else await get_focused_pid()
                for _ in range(amount):
                    await call_tool("hotkey", {"pid": pid, "keys": [key_map[direction]]})
            result_text = f"Scrolled {direction} {amount}x at ({req.coordinate[0]}, {req.coordinate[1]})"

        # ── list_windows ─────────────────────────────────────────────────────
        elif action == "list_windows":
            res = await call_tool("list_windows", {})
            result_text = "Open windows:\n"
            if hasattr(res, "content"):
                for item in res.content:
                    if item.type == "text":
                        try:
                            data = json.loads(item.text)
                            windows = data.get("windows", [])
                            if windows:
                                for w in windows:
                                    result_text += (
                                        f"  - pid={w.get('pid','?')} | window_id={w.get('window_id','?')} | "
                                        f"app={w.get('app', w.get('name','?'))} | title={w.get('title','?')}\n"
                                    )
                            else:
                                result_text += item.text
                        except Exception:
                            result_text += item.text
            # list_windows is informational — no screenshot needed
            return {"status": "success", "text": result_text.strip(), "base64_image": ""}

        # ── get_window_state ─────────────────────────────────────────────────
        elif action == "get_window_state":
            if req.pid is None or req.window_id is None:
                raise HTTPException(status_code=400, detail="pid and window_id are required for get_window_state")
            res = await call_tool("get_window_state", {"pid": req.pid, "window_id": req.window_id})
            result_text = f"Window state for pid={req.pid}, window_id={req.window_id}:\n"
            if hasattr(res, "content"):
                for item in res.content:
                    if item.type == "text":
                        result_text += item.text
                    elif item.type == "image":
                        b64_image = getattr(item, "data", "")
            # get_window_state returns its own screenshot — no auto-capture needed
            needs_screenshot = False

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: '{action}'. Valid actions: list_windows, get_window_state, screenshot, cursor_position, mouse_move, left_click, right_click, middle_click, double_click, left_click_drag, type, key, scroll")

    except HTTPException:
        raise
    except Exception as e:
        # On any unexpected error, reset the session so the next request starts fresh
        await reset_session()
        raise HTTPException(status_code=500, detail=f"Error executing action '{action}': {str(e)}")

    # Auto-screenshot after most actions (so LLM can verify the result)
    if needs_screenshot and not b64_image:
        b64_image = await take_screenshot()

    return {
        "status": "success",
        "text": result_text,
        "base64_image": b64_image,
    }
