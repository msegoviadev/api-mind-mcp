# api-mind MCP Server

MCP server for API discovery from `.mind` spec files. Works with Claude Code, Claude Desktop, and any MCP-compatible AI assistant.

## Quick Start

```bash
# 1. Install spec-mind to generate .mind files from OpenAPI specs
npm install -g @msegoviadev/spec-mind

# 2. Run the setup script from your project directory
curl -fsSL https://raw.githubusercontent.com/msegoviadev/api-mind-mcp/main/setup-mcp.sh | bash

# 3. Add your OpenAPI specs and generate .mind files
mkdir specs
cp your-api.yaml specs/
spec-mind sync --no-notation ./specs/

# 4. Restart Claude Code
```

In Claude Code:
```
What APIs are available?
Show me the endpoints for payments
Call GET /payments/{id} in dev
```

---

## Installation

### Prerequisites

Install [spec-mind](https://github.com/msegoviadev/spec-mind) to generate `.mind` files from your OpenAPI specs:

```bash
npm install -g @msegoviadev/spec-mind
```

### Setup

Run `setup-mcp.sh` from your project directory:

```bash
curl -fsSL https://raw.githubusercontent.com/msegoviadev/api-mind-mcp/main/setup-mcp.sh | bash
```

Or for user-wide installation (all projects):

```bash
curl -fsSL https://raw.githubusercontent.com/msegoviadev/api-mind-mcp/main/setup-mcp.sh | bash -s -- --global
```

The script:
- Creates a `specs/` directory in your project
- Registers api-mind in Claude Code with the correct specs path
- Scaffolds `~/.config/api-mind/dev.env` for environment defaults

---

## Usage

### 1. Add your API specs

```bash
# Copy your OpenAPI/Swagger YAML/JSON files to specs/
cp your-api.yaml specs/
```

### 2. Generate .mind files

```bash
spec-mind sync --no-notation ./specs/
```

### 3. Use in Claude Code

```
User: "What APIs are available?"
Claude: *uses list_apis tool*
"Found 2 APIs: ecommerce, payments"

User: "Show me payment endpoints"
Claude: *uses list_endpoints tool*
"POST /payments [auth: oauth2]
 GET /payments/{id}"

User: "Call GET /payments/{id} in dev"
Claude: *uses get_endpoint_schema + get_call_context tools*
"Resolved base URL: https://api.dev.example.com
 Calling GET /payments/123..."
```

---

## Tools

### list_apis
Lists all APIs loaded from the specs folder.

```
Input: none
Output: JSON with API names, titles, base URLs, and environments
```

### list_endpoints
Lists endpoints across all APIs.

```
Input:
  filter (optional): Substring match on method, path, or section
Output: JSON with environments and endpoint list
```

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

## Advanced Configuration

<details>
<summary>Manual installation and team setup</summary>

### Manual Installation

```bash
claude mcp add --transport stdio api-mind \
  --env SPECS_DIR=/absolute/path/to/specs \
  -- npx -y @msegoviadev/api-mind-mcp
```

**Important:** Always use absolute paths. MCP servers run as standalone processes without project context.

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

</details>

---

## Development (Contributors)

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
