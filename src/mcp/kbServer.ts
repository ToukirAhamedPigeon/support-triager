#!/usr/bin/env node
/**
 * Step 11: a custom MCP server exposing one tool specific to this support
 * workflow — search_kb — so the triager can check for a known resolution
 * before creating a ticket. stdio transport (see docs/custom-mcp-server.md
 * for why): this is a single-consumer companion process spawned by our own
 * orchestrator on the same machine, not a shared network service, so there's
 * no auth/TLS/multi-client surface for HTTP to justify.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KB_ARTICLES } from "./kbData.js";

function createKbServer(): McpServer {
  const server = new McpServer({ name: "support-kb", version: "1.0.0" });

  server.registerTool(
    "search_kb",
    {
      description:
        "Search the internal support knowledge base for articles relevant to a customer's issue, by keyword or topic tag. Use before creating a ticket to check for a known resolution.",
      inputSchema: {
        query: z.string().describe("Keywords or topic describing the customer's issue, e.g. 'password reset not arriving' or 'sso'"),
      },
    },
    async ({ query }) => {
      const q = query.toLowerCase();
      const matches = KB_ARTICLES.filter(
        (a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || a.tags.some((t) => q.includes(t) || t.includes(q)),
      );
      const text =
        matches.length === 0
          ? "No matching knowledge base articles found."
          : matches.map((a) => `[${a.id}] ${a.title}\n${a.body}`).join("\n\n");
      return { content: [{ type: "text", text }] };
    },
  );

  return server;
}

// This file is only ever run as a standalone subprocess (spawned over stdio
// by connectStdioMcpServer), never imported as a module, so it starts
// unconditionally rather than trying to detect direct-run vs. import.
const server = createKbServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("support-kb MCP server running on stdio");
