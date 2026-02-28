import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFinancialMcpServer } from "@/lib/mcp/financialServer";

async function main() {
  const server = createFinancialMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error("[MCP Server] Fatal error:", error);
  process.exit(1);
});
