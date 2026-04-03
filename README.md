# api-mind MCP Server

MCP server for API discovery from `.mind` spec files. Works with Claude Code, Claude Desktop, and any MCP-compatible AI assistant.

## Why

LLMs interacting with HTTP APIs need to discover endpoints, understand contracts, and make requests. api-mind provides 3 tools for discovery and context:

- **list_apis** - Discover available APIs
- **list_endpoints** - Find endpoints across APIs
- **get_endpoint_schema** - Get base URL, auth requirements, and schema

The LLM then constructs and executes curl commands with full transparency.

## Installation

### Option 1: Command-line argument (Recommended)

```bash
claude mcp add --transport stdio api-mind \
  -- npx -y @msegoviadev/api-mind-mcp /Users/YOUR/absolute/path/to/specs
```

**Important:** Use ABSOLUTE paths. Relative paths are not supported.

### Option 2: Environment variable

```bash
claude mcp add --transport stdio api-mind \
  --env SPECS_DIR=/Users/YOUR/absolute/path/to/specs \
  -- npx -y @msegoviadev/api-mind-mcp
```

### Option 3: Project configuration (Best for Teams)

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "api-mind": {
      "command": "npx",
      "args": ["-y", "@msegoviadev/api-mind-mcp"],
      "env": {
        "SPECS_DIR": "/Users/yourname/projects/yourproject/specs"
      }
    }
  }
}
```

**Note:** Each team member needs their own `.mcp.json` with their absolute path. Add `.mcp.json` to `.gitignore`.

### Setup Script for Teams

Create `setup-mcp.sh` in your project root:

```bash
#!/bin/bash
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
claude mcp add --transport stdio --scope project api-mind \
  --env SPECS_DIR="${PROJECT_ROOT}/specs" \
  -- npx -y @msegoviadev/api-mind-mcp
```

Team members run once:
```bash
chmod +x setup-mcp.sh
./setup-mcp.sh
```

## Local Development

For testing locally:

```bash
cd /path/to/api-mind-claude
npm install
npm run build

# Test with command-line argument
node dist/index.js /absolute/path/to/specs

# Test with environment variable
SPECS_DIR=/absolute/path/to/specs node dist/index.js

# Add to Claude Code for testing
claude mcp add --transport stdio api-mind-dev \
  -- node /path/to/api-mind-claude/dist/index.js /absolute/path/to/specs
```

## Setup

### 1. Add OpenAPI specs

```bash
mkdir specs
# Copy your OpenAPI/Swagger YAML/JSON files to specs/
```

### 2. Generate .mind files

```bash
npm install -g @msegoviadev/spec-mind
spec-mind sync --no-notation ./specs/
```

### 3. Commit both files

```bash
git add specs/*.yaml specs/*.mind
git commit -m "Add API specs"
```

### 4. Configure api-mind

Use one of the installation methods above to configure the specs directory.

## Tools

### list_apis

Lists all APIs loaded from the specs folder.

```
Input: none
Output: JSON with API names, titles, base URLs, and environments
```

Call first to discover what APIs are available.

### list_endpoints

Lists endpoints across all APIs.

```
Input:
  filter (optional): Substring match on method, path, or section

Output: JSON with environments and endpoint list
```

Call to find specific endpoints.

### get_endpoint_schema

Returns full context for an endpoint.

```
Input:
  api: API name
  method: HTTP method
  path: Endpoint path

Output: Text block with base URL, environments, auth, and schema
```

Call before constructing curl to understand the endpoint.

## Workflow

```
list_apis → list_endpoints → get_endpoint_schema → [LLM constructs curl] → bash
```

1. `list_apis` - Discover available APIs
2. `list_endpoints` - Find relevant endpoints
3. `get_endpoint_schema` - Get context (URL, auth, schema)
4. LLM constructs curl command with proper URL and headers
5. LLM executes via `bash` tool

## Auth Patterns

When `get_endpoint_schema` shows auth requirements, construct headers:

| Auth in Schema | curl Header |
|----------------|-------------|
| `None` | No header |
| `bearer` | `-H 'Authorization: Bearer <TOKEN>'` |
| `oauth2 <scopes>` | `-H 'Authorization: Bearer <TOKEN>'` |
| `api_key <header>` | `-H '<header>: <KEY>'` |
| `basic` | `-H 'Authorization: Basic <base64>'` |

## Why Absolute Paths?

MCP servers run as standalone processes without project context. The working directory may be `/` or a system directory. Unlike plugins that receive project context, MCP servers must receive explicit configuration.

Always use absolute paths when configuring MCP servers.

## Example Usage

Once configured, use the tools directly in Claude Code:

```
User: "What APIs are available?"
Claude: *uses list_apis tool*
"I found 2 APIs loaded:
1. ecommerce - E-commerce API
2. payments - Payments API"

User: "Show me the endpoints for creating a payment"
Claude: *uses list_endpoints tool with filter="payment"*
"Here are payment endpoints:
POST /payments [auth: oauth2 payments:write]
..."

User: "Get the schema for POST /payments"
Claude: *uses get_endpoint_schema tool*
"POST /payments
Auth: oauth2 payments:write
Body: CreatePaymentRequest {...}
..."
```

## NOTATION Legend

The schema uses a compact notation:

```
? optional | [ro] readOnly | [w] writeOnly | =val default
^ header | ~ cookie | | enum | {*:T} map | ~~name~~ deprecated
```

## Development

### Build

```bash
npm run build
```

### Test Locally

```bash
node dist/index.js /absolute/path/to/specs
```

## Related

- [spec-mind](https://github.com/msegoviadev/spec-mind) - Generate `.mind` files from OpenAPI specs
- [api-mind](https://github.com/msegoviadev/api-mind) - OpenCode plugin version

## License

MIT