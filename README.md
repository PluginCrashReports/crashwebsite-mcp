# crashwebsite-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes your plugin crash
reports to Claude. It is a thin, read-only client over the crash site's JSON API
(`/api/...`), authenticated by your **personal API key** and scoped to every
plugin you can see across all your teams.

## Tools

| Tool | Endpoint | Purpose |
| --- | --- | --- |
| `list_plugins` | `GET /api/plugins/` | The plugins you can access (ids/codes for the `plugin` arg). |
| `list_frequent_crashes` | `GET /api/frequent/` | Top crash locations grouped by function, with counts. |
| `list_recent_crashes` | `GET /api/recent/` | Most recent individual crashes, newest first. |
| `search_crashes` | `GET /api/search/` | Search by crash filename / function text. |
| `get_crash_log` | `GET /api/log/{id}/` | Full details + symbolicated stack for one crash. |
| `get_crash_stats` | `GET /api/stats/` | Totals, last 7/30 days, unique functions, by version/platform. |
| `list_versions` | `GET /api/versions/` | Distinct versions and host apps (for filters). |

Every tool except `list_plugins` takes an optional `plugin` (id, code, or name).
It's only required when you can access more than one plugin — otherwise the sole
plugin is used. The list tools also accept filters: `ver`, `verop`
(`=`/`>=`/`<=`), `os` (`win`/`mac`/`linux`), `app`, `limit`.

## Configuration

Set via environment variables:

- `CRASH_API_KEY` (**required**) — your personal API key. Generate it on the
  crash site's **Account** page. It grants read access to every plugin you can
  see; keep it secret, like a password.
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
