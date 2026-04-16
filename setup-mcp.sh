#!/bin/bash
# Setup script for api-mind MCP server
# Run once per project (default) or with --global for user-wide installation

set -e

GLOBAL=false
for arg in "$@"; do
  [[ "$arg" == "--global" ]] && GLOBAL=true
done

PROJECT_ROOT="$(pwd)"
SPECS_DIR="${PROJECT_ROOT}/specs"

if $GLOBAL; then
  MCP_SCOPE="user"
else
  MCP_SCOPE="project"
fi

echo "Setting up api-mind MCP server..."
echo "Project root: ${PROJECT_ROOT}"
echo "Specs directory: ${SPECS_DIR}"
echo "Scope: ${MCP_SCOPE}"

# Create specs directory if missing
if [ ! -d "$SPECS_DIR" ]; then
  echo "Creating specs directory..."
  mkdir -p "$SPECS_DIR"
fi

# Warn if no .mind files exist yet
MIND_FILES=$(find "$SPECS_DIR" -name "*.mind" 2>/dev/null | wc -l | tr -d ' ')
if [ "$MIND_FILES" -eq 0 ]; then
  echo ""
  echo "No .mind files found in $SPECS_DIR"
  echo "Generate them with: spec-mind sync --no-notation ${SPECS_DIR}/"
  echo ""
fi

# Register api-mind MCP server with Claude Code
echo "Adding api-mind to Claude Code (scope: ${MCP_SCOPE})..."
claude mcp add --transport stdio --scope "$MCP_SCOPE" api-mind \
  --env SPECS_DIR="$SPECS_DIR" \
  -- npx -y @msegoviadev/api-mind-mcp

# Scaffold ~/.config/api-mind/ with example env file and global specs dir
CONFIG_DIR="$HOME/.config/api-mind"
if [ ! -d "$CONFIG_DIR" ]; then
  mkdir -p "$CONFIG_DIR"
  echo "Created: $CONFIG_DIR"
fi
if [ ! -d "$CONFIG_DIR/specs" ]; then
  mkdir "$CONFIG_DIR/specs"
  echo "Created: $CONFIG_DIR/specs"
fi

if [ ! -f "$CONFIG_DIR/dev.env" ]; then
  cat > "$CONFIG_DIR/dev.env" << 'EOF'
# api-mind environment defaults - dev
# Used by get_call_context to resolve base URLs and credentials.
# Add per-API overrides in subdirectories: ~/.config/api-mind/<api-name>/dev.env

# base_url overrides the placeholder URL from the spec:
# base_url=https://api.dev.example.com

# Example Auth0 defaults:
# tenant=https://auth.dev.example.com
# auth0_client_id=
# auth0_cacert=/etc/ssl/cert.pem
EOF
  chmod 600 "$CONFIG_DIR/dev.env"
  echo "Created: $CONFIG_DIR/dev.env"
fi

echo ""
echo "api-mind configured successfully (scope: $MCP_SCOPE)"
echo ""
echo "Next steps:"
echo "1. Add OpenAPI specs to: ${SPECS_DIR}/"
echo "2. Generate .mind files: spec-mind sync --no-notation ${SPECS_DIR}/"
echo "3. Fill in defaults: $CONFIG_DIR/dev.env"
echo "4. Optionally add global specs (available in all projects): $CONFIG_DIR/specs/"
echo "5. Restart Claude Code"
echo ""
if ! $GLOBAL; then
  echo "To install globally instead:"
  echo "  bash setup-mcp.sh --global"
  echo ""
fi
