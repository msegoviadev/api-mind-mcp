import { getCallContext } from "../core/loader.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const definition: Tool = {
  name: "get_call_context",
  description: `Returns the runtime context needed to execute API calls: resolved base URL, active environment, and default values for credentials and parameters.

Call this before constructing a curl command when the user wants to actually invoke an endpoint.
Do NOT call this just to browse or understand the API shape — use list_endpoints and get_endpoint_schema for that.

Reads from ~/.config/api-mind/<env>.env and ~/.config/api-mind/<api>/<env>.env.
Defaults to "dev" unless the user specifies otherwise.`,
  inputSchema: {
    type: "object",
    properties: {
      api: {
        type: "string",
        description: "API name matching the .mind filename (e.g. auth0-management-v2)",
      },
      env: {
        type: "string",
        description: "Environment to use (e.g. stage, uat). Defaults to dev.",
      },
    },
    required: ["api"],
  },
};

export async function handler(args: { api: string; env?: string }) {
  try {
    const result = await getCallContext(args.api, args.env);

    const defaultsBlock = Object.entries(result.defaults)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const output = `# Call Context: ${result.api}
# Environment: ${result.env}
# Base URL: ${result.baseUrl}

## Defaults
${defaultsBlock || "(none)"}`;

    return {
      content: [{ type: "text", text: output }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}
