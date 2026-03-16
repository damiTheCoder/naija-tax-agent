import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPersonalAssistantMcpServer } from "@/lib/mcp/personalAssistantServer";

async function main() {
  const server = createPersonalAssistantMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("[Personal Assistant MCP] Fatal error:", error);
  process.exit(1);
});
