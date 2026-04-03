import { listApis } from "../core/loader.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const definition: Tool = {
  name: "list_apis",
  description: `Lists all APIs loaded from the specs folder, with their names, titles, base URLs, and available environments.

Use this when you need to know what APIs are loaded or what environments a specific API supports.
Call this first when the user references an API you haven't seen yet.`,
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handler(args: Record<string, never>) {
  const result = await listApis();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}