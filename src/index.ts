#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// The base URL of the crash site and a plugin's crash API key. The key scopes
// every request to that one plugin's crashes.
const BASE_URL = (process.env.CRASH_API_BASE_URL ?? "https://crashreports.rabiensoftware.com").replace(/\/+$/, "");
const API_KEY = process.env.CRASH_API_KEY ?? "";

if (!API_KEY) {
  console.error(
    "crashwebsite-mcp: CRASH_API_KEY (a plugin's crash API key) is required. " +
    "Optionally set CRASH_API_BASE_URL (default https://crashreports.rabiensoftware.com)."
  );
  process.exit(1);
}

// Filters accepted by the list-style endpoints, matching the site's /api filters.
const filterShape = {
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

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({ name: "crashwebsite-mcp", version: "1.0.0" });

server.tool(
  "list_frequent_crashes",
  "List the most frequent crash locations for this plugin, grouped by function, with counts and the most recent date. Use this to find the top crashes.",
  filterShape,
  async (args) => json(await apiGet("/api/frequent/", args))
);

server.tool(
  "list_recent_crashes",
  "List the most recent individual crash reports for this plugin, newest first. Each row includes an `id` usable with get_crash_log.",
  filterShape,
  async (args) => json(await apiGet("/api/recent/", args))
);

server.tool(
  "search_crashes",
  "Search this plugin's crash reports by text matched against the crash filename and the extracted function name.",
  {
    text: z.string().min(1).describe("Text to search for in the crash name or function."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows to return (1-500, default 100)."),
  },
  async (args) => json(await apiGet("/api/search/", args))
);

server.tool(
  "get_crash_log",
  "Get the full details and symbolicated stack trace (crashlog) for a single crash by its numeric id.",
  { id: z.number().int().describe("Crash id, as returned by the list/search tools.") },
  async ({ id }) => json(await apiGet(`/api/log/${id}/`))
);

server.tool(
  "get_crash_stats",
  "Get aggregate crash statistics for this plugin: total, last 7/30 days, unique functions, and breakdowns by version and platform.",
  {},
  async () => json(await apiGet("/api/stats/"))
);

server.tool(
  "list_versions",
  "List the distinct plugin versions and host application names present in this plugin's crash data. Useful for building filters.",
  {},
  async () => json(await apiGet("/api/versions/"))
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`crashwebsite-mcp running on stdio (base ${BASE_URL})`);
