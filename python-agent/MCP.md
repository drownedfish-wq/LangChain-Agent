# MCP Integration

This backend can load tools from Model Context Protocol servers and merge them
with the existing local LangChain tools.

## Install

```powershell
pip install -r requirements.txt
```

## Configure

Create `mcp_servers.json` in this directory. You can copy
`mcp_servers.example.json` and edit it.

Example:

```json
{
  "filesystem": {
    "transport": "stdio",
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "D:/AgentWorkspace"
    ]
  }
}
```

You can also set `MCP_CONFIG_FILE` or `MCP_SERVERS_JSON`.

## APIs

```text
GET  /api/mcp/status
POST /api/mcp/reload
POST /api/tool/run
```

`/api/tool/run` loads local tools and configured MCP tools before invoking the
agent.
