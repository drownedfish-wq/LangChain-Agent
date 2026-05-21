import json
import os
from pathlib import Path
from typing import Any

from config import settings


class MCPClientManager:
    """Load MCP tools from configured MCP servers."""

    def __init__(self) -> None:
        self._client = None
        self._tools = None
        self._last_error: str | None = None

    @property
    def last_error(self) -> str | None:
        return self._last_error

    def load_connections(self) -> dict[str, Any]:
        raw = os.getenv("MCP_SERVERS_JSON", "").strip()
        if raw:
            return json.loads(raw)

        config_file = Path(settings.MCP_CONFIG_FILE)
        if not config_file.is_absolute():
            config_file = Path(__file__).resolve().parent / config_file

        if not config_file.exists():
            return {}

        return json.loads(config_file.read_text(encoding="utf-8"))

    async def get_tools(self, force_reload: bool = False) -> list:
        if self._tools is not None and not force_reload:
            return self._tools

        connections = self.load_connections()
        if not connections:
            self._tools = []
            self._last_error = None
            return self._tools

        try:
            from langchain_mcp_adapters.client import MultiServerMCPClient
        except ImportError as exc:
            self._tools = []
            self._last_error = (
                "MCP dependencies are not installed. "
                "Run: pip install -r requirements.txt"
            )
            raise RuntimeError(self._last_error) from exc

        try:
            self._client = MultiServerMCPClient(connections)
            self._tools = await self._client.get_tools()
            self._last_error = None
            return self._tools
        except Exception as exc:
            self._tools = []
            self._last_error = str(exc)
            raise

    async def status(self) -> dict[str, Any]:
        connections = self.load_connections()
        tools = []
        error = None
        try:
            tools = await self.get_tools()
        except Exception as exc:
            error = str(exc)

        return {
            "enabled": bool(connections),
            "servers": list(connections.keys()),
            "tool_count": len(tools),
            "tools": [
                {
                    "name": getattr(tool, "name", ""),
                    "description": getattr(tool, "description", ""),
                }
                for tool in tools
            ],
            "error": error or self._last_error,
        }

    def clear_cache(self) -> None:
        self._tools = None
        self._client = None
        self._last_error = None


mcp_manager = MCPClientManager()
