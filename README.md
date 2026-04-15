# api-mind MCP Server

MCP server for API discovery from `.mind` spec files. Works with Claude Code, Claude Desktop, and any MCP-compatible AI assistant.

## Quick Start

Try it now with example specs:

```bash
# Use built-in examples (after installation)
claude mcp add --transport stdio api-mind \
  -- npx -y @msegoviadev/api-mind-mcp $(pwd)/specs

# Or with your own specs
claude mcp add --transport stdio api-mind \
  -- npx -y @msegoviadev/api-mind-mcp /absolute/path/to/specs
```

In Claude Code:
```
What APIs are available?
Show me the endpoints for posts
Get the schema for GET /posts
Call GET /posts in dev
```

---

## Installation

### Prerequisites

Install [spec-mind](https://github.com/msegoviadev/spec-mind) to generate `.mind` files from your OpenAPI specs:

```bash
npm install -g @msegoviadev/spec-mind
```

### Install api-mind-mcp

```bash
claude mcp add --transport stdio api-mind \
  -- npx -y @msegoviadev/api-mind-mcp /absolute/path/to/specs
```

**Important:** 
- Always use **absolute paths** (MCP servers don't have project context)
- Use `$(pwd)/specs` to reference your current directory
- Or use full paths like `/Users/you/projects/your-project/specs`

---

## Usage

### 1. Add your API specs

```bash
mkdir specs
# Copy your OpenAPI/Swagger YAML/JSON files to specs/
```

### 2. Generate .mind files

```bash
cd specs
spec-mind sync --no-notation ./
```

### 3. Configure with your specs

**From your project directory:**

```bash
# Use specs in current directory
claude mcp add --transport stdio api-mind \
  -- npx -y @msegoviadev/api-mind-mcp $(pwd)/specs

# Or specify full path
claude mcp add --transport stdio api-mind \
  -- npx -y @msegoviadev/api-mind-mcp /Users/you/projects/your-project/specs
```

**Important:** MCP servers require absolute paths. Use `$(pwd)` or full paths, never relative paths like `./specs`.

### 4. Use in Claude Code

```
User: "What APIs are available?"
Claude: *uses list_apis tool*
"Found 2 APIs: ecommerce, payments"

User: "Show me payment endpoints"
Claude: *uses list_endpoints tool*
"POST /payments [auth: oauth2]
 GET /payments/{id}"

User: "Get schema for POST /payments"
Claude: *uses get_endpoint_schema tool*
"POST /payments
Auth: oauth2 payments:write
Body: CreatePaymentRequest {...}"
```

---

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

Call before constructing curl to understand the endpoint contract.

### get_call_context
Returns runtime context needed to execute API calls.

```
Input:
  api: API name
  env (optional): Environment to use (dev, stage, uat). Defaults to dev.
Output: Resolved base URL, active environment, and default values for credentials and parameters
```

Call this before constructing curl when the user wants to actually invoke an endpoint.
Reads from `~/.config/api-mind/<env>.env` and `~/.config/api-mind/<api>/<env>.env`.

---

## Auth Patterns

When `get_endpoint_schema` shows auth requirements, construct headers:

| Auth in Schema | curl Header |
|----------------|-------------|
| `None` | No header |
| `bearer` | `-H 'Authorization: Bearer <TOKEN>'` |
| `oauth2 <scopes>` | `-H 'Authorization: Bearer <TOKEN>'` |
| `api_key <header>` | `-H '<header>: <KEY>'` |
| `basic` | `-H 'Authorization: Basic <base64>'` |

---

## Why Absolute Paths?

MCP servers run as standalone processes without project context. The working directory may be `/` or a system directory. Unlike plugins that receive project context, MCP servers must receive explicit configuration.

Always use absolute paths when configuring MCP servers.

---

## Workflow

```
list_apis → list_endpoints → get_endpoint_schema → get_call_context → [LLM constructs curl] → bash
```

1. `list_apis` - Discover available APIs
2. `list_endpoints` - Find relevant endpoints
3. `get_endpoint_schema` - Get endpoint contract (URL, auth, schema)
4. `get_call_context` - Resolve base URL and credentials for the target environment
5. LLM constructs curl command using resolved values
6. LLM executes via `bash` tool

---

## Environment Defaults

`get_call_context` reads default values from `~/.config/api-mind/`:

```
~/.config/api-mind/
  dev.env        # base defaults for all APIs (dev environment)
  stage.env      # base defaults for stage
  auth0/
    dev.env      # API-specific overrides for auth0
```

Each `.env` file uses `key=value` format (lines starting with `#` are ignored). The `base_url` key overrides the placeholder URL from the spec.

Example `~/.config/api-mind/dev.env`:
```
base_url=https://api.dev.example.com
auth0_client_id=abc123
auth0_cacert=/etc/ssl/cert.pem
```

`setup-mcp.sh` scaffolds this file on first run.

---

## Advanced Configuration

<details>
<summary>For teams and advanced users</summary>

### Environment Variable

```bash
claude mcp add --transport stdio api-mind \
  --env SPECS_DIR=/absolute/path/to/specs \
  -- npx -y @msegoviadev/api-mind-mcp
```

### Project Configuration (.mcp.json)

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "api-mind": {
      "command": "npx",
      "args": ["-y", "@msegoviadev/api-mind-mcp"],
      "env": {
        "SPECS_DIR": "/absolute/path/to/specs"
      }
    }
  }
}
```

**Note:** Each team member needs their own `.mcp.json` with their absolute path. Add `.mcp.json` to `.gitignore`.

### Setup Script

Run `setup-mcp.sh` from your project directory for automated setup:

```bash
bash setup-mcp.sh          # project scope (default)
bash setup-mcp.sh --global # user scope (all projects)
```

The script:
- Registers api-mind in Claude Code with the correct specs path
- Scaffolds `~/.config/api-mind/dev.env` for environment defaults
- Supports `--global` for user-wide installation vs per-project

</details>

---

## Development (Contributors)

For developing api-mind-mcp itself:

```bash
git clone https://github.com/msegoviadev/api-mind-mcp
cd api-mind-mcp
npm install
npm run build

# Test locally
node dist/index.js /path/to/specs
```

---

## Related

- [spec-mind](https://github.com/msegoviadev/spec-mind) - Generate `.mind` files from OpenAPI specs
- [api-mind](https://github.com/msegoviadev/api-mind) - OpenCode plugin version

## License

MIT