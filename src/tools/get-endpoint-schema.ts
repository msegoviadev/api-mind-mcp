import { getEndpointSchema } from "../core/loader.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const definition: Tool = {
  name: "get_endpoint_schema",
  description: `Returns the full context for a specific endpoint including resolved URL, auth requirements, and schema.

Use this to understand an endpoint before constructing a curl command to execute via the bash tool.
Call this after list_endpoints to get the endpoint contract.

## Auth Patterns

| Auth in Schema | curl Header |
|----------------|-------------|
| \`None\` | No header |
| \`bearer\` | \`-H 'Authorization: Bearer <TOKEN>'\` |
| \`oauth2 <scopes>\` | \`-H 'Authorization: Bearer <TOKEN>'\` |
| \`api_key <header>\` | \`-H '<header>: <KEY>'\` |
| \`basic\` | \`-H 'Authorization: Basic <base64>'\` |

## NOTATION Legend

\`?\` optional | \`[ro]\` readOnly | \`[w]\` writeOnly | \`=val\` default
\`^\` header | \`~\` cookie | \`*N\` multipleOf N | \`|\` enum or nullable
\`OneOf<A,B>\` on field = discriminated union
\`{*:T}\` = map/dict | \`{...}\` = open object | \`extends\` = allOf
\`&\` = inline extension | \`~~name~~\` deprecated | \`#\` = inline note
\`[multipart]\` \`[form]\` \`[binary]\` \`[text]\` = request body encoding`,
  inputSchema: {
    type: "object",
    properties: {
      api: {
        type: "string",
        description: "API name matching the .mind filename",
      },
      method: {
        type: "string",
        description: "HTTP method (GET, POST, PUT, PATCH, DELETE)",
      },
      path: {
        type: "string",
        description: "Endpoint path",
      },
    },
    required: ["api", "method", "path"],
  },
};

export async function handler(args: { api: string; method: string; path: string }) {
  try {
    const result = await getEndpointSchema(args.api, args.method, args.path);
    
    const envList = Object.entries(result.environments)
      .map(([name, url]) => `  ${name}: ${url}`)
      .join("\n");
    
    const authLine = result.auth ? `Auth: ${result.auth}` : "Auth: None";
    
    const output = `# API: ${result.title}
# Base URL: ${result.defaultUrl}
# Environments:
${envList}

## Endpoint
${result.method} ${result.path}
${authLine}

## Schema
${result.schema}`;
    
    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}