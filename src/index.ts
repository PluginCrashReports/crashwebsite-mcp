#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// The base URL of the crash site and your personal API key. The key identifies
// you and scopes every request to the plugins you can see across all your teams.
const BASE_URL = (process.env.CRASH_API_BASE_URL ?? "https://crashreports.rabiensoftware.com").replace(/\/+$/, "");
const API_KEY = process.env.CRASH_API_KEY ?? "";

if (!API_KEY) {
  console.error(
    "crashwebsite-mcp: CRASH_API_KEY (your personal API key from the Account page) is required. " +
    "Optionally set CRASH_API_BASE_URL (default https://crashreports.rabiensoftware.com)."
  );
  process.exit(1);
}

// Which plugin a crash query targets. Optional when you can see only one plugin;
// otherwise pass an id, plugin code, or name (see list_plugins).
const pluginArg = {
  plugin: z
    .string()
    .optional()
    .describe("Which plugin to query: id, plugin code, or name. Omit if you have only one; otherwise required (see list_plugins)."),
};

// Filters accepted by the list-style endpoints, matching the site's /api filters.
const filterShape = {
  ...pluginArg,
  ver: z.string().optional().describe('Version filter, e.g. "1.0.7". Omit or "all" for every version.'),
  verop: z
    .enum(["=", ">=", "<="])
    .optional()
    .describe('Comparison operator for the version filter (default "="). Uses natural version ordering.'),
  os: z
    .enum(["all", "win", "mac", "linux"])
    .optional()
    .describe('Platform filter (default "all").'),
  app: z.string().optional().describe('Host application filter, e.g. "Ableton Live 11". Omit or "all" for every app.'),
  limit: z.number().int().min(1).max(500).optional().describe("Max rows to return (1-500, default 100)."),
};

async function apiGet(path: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText} ${body}`.trim());
  }
  return res.json();
}

async function apiPost(path: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText} ${text}`.trim());
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({ name: "crashwebsite-mcp", version: "1.0.0" });

server.tool(
  "list_plugins",
  "List the plugins you can access, across all your teams, with the id and code to pass as the `plugin` argument to the other tools.",
  {},
  async () => json(await apiGet("/api/plugins/"))
);

server.tool(
  "list_frequent_crashes",
  "List the most frequent crash locations for a plugin, grouped by function, with counts and the most recent date. Use this to find the top crashes.",
  filterShape,
  async (args) => json(await apiGet("/api/frequent/", args))
);

server.tool(
  "list_recent_crashes",
  "List the most recent individual crash reports for a plugin, newest first. Each row includes an `id` usable with get_crash_log.",
  filterShape,
  async (args) => json(await apiGet("/api/recent/", args))
);

server.tool(
  "search_crashes",
  "Search a plugin's crash reports by text matched against the crash filename and the extracted function name.",
  {
    ...pluginArg,
    text: z.string().min(1).describe("Text to search for in the crash name or function."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows to return (1-500, default 100)."),
  },
  async (args) => json(await apiGet("/api/search/", args))
);

server.tool(
  "get_crash_log",
  "Get the full details and symbolicated stack trace (crashlog) for a single crash by its numeric id.",
  {
    id: z.number().int().describe("Crash id, as returned by the list/search tools."),
    ...pluginArg,
  },
  async ({ id, plugin }) => json(await apiGet(`/api/log/${id}/`, { plugin }))
);

server.tool(
  "get_crash_stats",
  "Get aggregate crash statistics for a plugin: total, last 7/30 days, unique functions, and breakdowns by version and platform.",
  { ...pluginArg },
  async (args) => json(await apiGet("/api/stats/", args))
);

server.tool(
  "list_versions",
  "List the distinct plugin versions and host application names present in a plugin's crash data. Useful for building filters.",
  { ...pluginArg },
  async (args) => json(await apiGet("/api/versions/", args))
);

server.tool(
  "list_comments",
  "List the comments on a crash function (a crash location) for a plugin.",
  {
    ...pluginArg,
    func: z.string().min(1).describe("The crash function/location the comments hang off (as shown by list_frequent_crashes / get_crash_log)."),
  },
  async (args) => json(await apiGet("/api/comments/", args))
);

server.tool(
  "add_comment",
  "Add a comment to a crash function (a crash location) for a plugin. Attributed to you.",
  {
    ...pluginArg,
    func: z.string().min(1).describe("The crash function/location to comment on."),
    comment: z.string().min(1).describe("The comment text."),
  },
  async (args) => json(await apiPost("/api/comments/", args))
);

server.tool(
  "list_teams",
  "List the teams you belong to, with your role — useful for choosing where to add a plugin.",
  {},
  async () => json(await apiGet("/api/teams/"))
);

server.tool(
  "add_plugin",
  "Register a new plugin under one of your teams. Requires owner/admin on that team.",
  {
    team: z.string().optional().describe("Which team (id or name) to add the plugin to. Omit if you manage only one team (see list_teams)."),
    name: z.string().min(2).describe('Display name, e.g. "Identity".'),
    plugin_code: z.string().min(1).describe('Bundle id / code used to match crashes, e.g. "com.socalabs.identity".'),
  },
  async (args) => json(await apiPost("/api/plugins/", args))
);

server.tool(
  "delete_plugin",
  "Permanently delete a plugin and ALL its crashes, symbols and comments. Owner/admin only; irreversible.",
  {
    ...pluginArg,
    confirm: z.string().describe("Must equal the plugin's exact plugin_code, as a safety check, to actually delete."),
  },
  async (args) => json(await apiPost("/api/plugins/delete/", args))
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`crashwebsite-mcp running on stdio (base ${BASE_URL})`);
