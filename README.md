# crashwebsite-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes a plugin's crash
reports to Claude. It is a thin, read-only client over the crash site's JSON API
(`/api/...`), scoped to a single plugin by its **crash API key**.

## Tools

| Tool | Endpoint | Purpose |
| --- | --- | --- |
| `list_frequent_crashes` | `GET /api/frequent/` | Top crash locations grouped by function, with counts. |
| `list_recent_crashes` | `GET /api/recent/` | Most recent individual crashes, newest first. |
| `search_crashes` | `GET /api/search/` | Search by crash filename / function text. |
| `get_crash_log` | `GET /api/log/{id}/` | Full details + symbolicated stack for one crash. |
| `get_crash_stats` | `GET /api/stats/` | Totals, last 7/30 days, unique functions, by version/platform. |
| `list_versions` | `GET /api/versions/` | Distinct versions and host apps (for filters). |

`list_frequent_crashes` and `list_recent_crashes` accept optional filters:
`ver`, `verop` (`=`/`>=`/`<=`), `os` (`win`/`mac`/`linux`), `app`, `limit`.

## Configuration

Set via environment variables:

- `CRASH_API_KEY` (**required**) — a plugin's crash API key. Find it under the
  plugin's **Keys** page on the crash site. Every request is scoped to that
  plugin. Note: this key also ships (world-readable) in installed plugins, so it
  identifies rather than secures the plugin — treat this API as public read.
- `CRASH_API_BASE_URL` (optional) — defaults to
  `https://crashreports.rabiensoftware.com`.

## Install & build

Run it on your own machine — it talks to the public crash site by default, so
there's no server-side setup.

```bash
git clone https://github.com/Rabien-Software/crashwebsite-mcp.git
cd crashwebsite-mcp
npm install
npm run build
```

## Use with Claude Code / Desktop

Claude Code, one line:

```bash
claude mcp add crashwebsite -e CRASH_API_KEY=your-plugin-crash-api-key \
  -- node /absolute/path/to/crashwebsite-mcp/dist/index.js
```

Or add to your MCP config (e.g. `claude_desktop_config.json`) directly:

```json
{
  "mcpServers": {
    "crashwebsite": {
      "command": "node",
      "args": ["/absolute/path/to/crashwebsite-mcp/dist/index.js"],
      "env": {
        "CRASH_API_KEY": "your-plugin-crash-api-key"
      }
    }
  }
}
```

To point at a self-hosted instance instead of the public site, also set
`CRASH_API_BASE_URL`.

Then ask Claude things like _"what are the top crashes this week?"_,
_"show recent mac crashes for 1.0.7"_, or _"open crash 3 and explain the stack"_.
