/**
 * Standalone MCP stdio entry point for the checkup plugin.
 * Run with: node dist/mcp-stdio.js
 *
 * This starts the checkup MCP server over stdin/stdout so Claude Code
 * can communicate with it as a plugin MCP server.
 */

async function main(): Promise<void> {
  try {
    // Dynamic imports — these resolve at runtime when the real
    // @modelcontextprotocol/server package is installed (not the monorepo stub)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { server } = await import("./mcp.js");
    const sdkStdio = await import("@modelcontextprotocol/server/stdio" as string);
    const transport = new sdkStdio.StdioServerTransport();
    await (server as unknown as { connect: (t: unknown) => Promise<void> }).connect(
      transport,
    );
  } catch (err) {
    console.error(
      "checkup: failed to start MCP server. Ensure @modelcontextprotocol/server is installed.",
    );
    console.error(err);
    process.exit(1);
  }
}

main();
