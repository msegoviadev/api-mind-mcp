import { listEndpoints } from "../core/loader.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const definition: Tool = {
  name: "list_endpoints",
  description: `Lists all available endpoints across all loaded .mind files. Also surfaces the available environment names.

Use this to discover what endpoints exist across all APIs. Filter by method, path, or section.
Call this when the user references an API or asks what's available.`,
  inputSchema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description: "Substring match on method, path, or section name",
      },
    },
  },
};

export async function handler(args: { filter?: string }) {
  const result = await listEndpoints(args.filter);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}