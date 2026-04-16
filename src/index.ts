#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { initIndex } = require("./core/loader.js");
const { initNodeBindings } = require("./lib/node-bindings.js");
const { definition: listApisDefinition, handler: listApisHandler } = require("./tools/list-apis.js");
const { definition: listEndpointsDefinition, handler: listEndpointsHandler } = require("./tools/list-endpoints.js");
const { definition: getEndpointSchemaDefinition, handler: getEndpointSchemaHandler } = require("./tools/get-endpoint-schema.js");
const { definition: getCallContextDefinition, handler: getCallContextHandler } = require("./tools/get-call-context.js");
const { resolve, isAbsolute, join } = require("path");
const { homedir } = require("os");

// Initialize Node.js bindings for file system operations
initNodeBindings();

// Get specs directory from command-line, env var, or error
function getSpecsDir() {
  // Priority 1: Command-line argument
  const args = process.argv.slice(2);
  if (args[0]) {
    if (!isAbsolute(args[0])) {
      console.error(`
[api-mind] ERROR: Relative paths not supported.
Provided: ${args[0]}
Absolute: ${resolve(args[0])}

Use absolute path:
  claude mcp add api-mind -- node dist/index.js ${resolve(args[0])}
`);
      process.exit(1);
    }
    return args[0];
  }
  
  // Priority 2: Environment variable
  if (process.env.SPECS_DIR) {
    if (!isAbsolute(process.env.SPECS_DIR)) {
      console.error(`
[api-mind] ERROR: SPECS_DIR must be absolute.
Provided: ${process.env.SPECS_DIR}
Absolute: ${resolve(process.env.SPECS_DIR)}

Use:
  SPECS_DIR=${resolve(process.env.SPECS_DIR)} claude mcp add api-mind -- ...
`);
      process.exit(1);
    }
    return process.env.SPECS_DIR;
  }
  
  // Priority 3: No configuration - show setup options
  console.error(`
[api-mind] ERROR: No specs directory configured.

Quick examples:

  # Use your own specs directory
  claude mcp add api-mind -- npx -y @msegoviadev/api-mind-mcp $(pwd)/specs

  # Or specify full path
  claude mcp add api-mind -- npx -y @msegoviadev/api-mind-mcp /Users/you/projects/your-project/specs

Setup options:

1. Command-line argument:
   claude mcp add api-mind -- npx -y @msegoviadev/api-mind-mcp /ABSOLUTE/PATH/TO/SPECS

2. Environment variable:
   claude mcp add api-mind --env SPECS_DIR=/ABSOLUTE/PATH/TO/SPECS -- npx -y @msegoviadev/api-mind-mcp

3. Project .mcp.json:
   {
     "mcpServers": {
       "api-mind": {
         "command": "npx",
         "args": ["-y", "@msegoviadev/api-mind-mcp"],
         "env": { "SPECS_DIR": "/ABSOLUTE/PATH/TO/SPECS" }
       }
     }
   }

Requirements:
- Use ABSOLUTE paths only
- Generate .mind files: spec-mind sync --no-notation ./specs/

Docs: https://github.com/msegoviadev/api-mind-mcp
`);
  process.exit(1);
}

const SPECS_DIR = getSpecsDir();
const GLOBAL_SPECS_DIR = join(homedir(), ".config", "api-mind", "specs");
const SPECS_DIRS = [SPECS_DIR, GLOBAL_SPECS_DIR];
console.error(`[api-mind] Loading specs from: ${SPECS_DIRS.join(", ")}`);

// Create MCP server
const server = new Server(
  {
    name: "api-mind",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize index on startup
let indexReady = false;
let indexError = null;

initIndex({ specsDirs: SPECS_DIRS })
  .then(() => {
    indexReady = true;
    console.error("[api-mind] Index initialized successfully");
  })
  .catch((err) => {
    indexError = err;
    console.error("[api-mind] Failed to initialize index:", err.message);
  });

// Register tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      listApisDefinition,
      listEndpointsDefinition,
      getEndpointSchemaDefinition,
      getCallContextDefinition,
    ],
  };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Check if index is ready
  if (!indexReady) {
    if (indexError) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Failed to initialize index: ${indexError.message}`,
          },
        ],
        isError: true,
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: "Error: Index not initialized. Please wait and try again.",
        },
      ],
      isError: true,
    };
  }
  
  try {
    switch (name) {
      case "list_apis":
        return await listApisHandler(args);
      
      case "list_endpoints":
        return await listEndpointsHandler(args);
      
      case "get_endpoint_schema":
        return await getEndpointSchemaHandler(args);

      case "get_call_context":
        return await getCallContextHandler(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[api-mind] MCP server running on stdio");
}

main().catch((error) => {
  console.error("[api-mind] Fatal error:", error);
  process.exit(1);
});