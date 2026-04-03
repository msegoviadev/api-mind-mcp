import type { ParsedApiHeader, ParsedEndpoint } from "./types"

const API_HEADER_REGEX = /^#\s*API:\s*(.+?)\s*—\s*(.+)$/
const SERVERS_HEADER_REGEX = /^#\s*Servers:\s*(.+)$/
const SECTION_HEADER_REGEX = /^##\s+(.+?)\s*$/
const ENDPOINT_LINE_REGEX = /^(~~)?([A-Z]+)(~~)?\s+(\/[^\s]*?)(\s+\[auth:\s*(.+?)\])?\s*$/
const SCHEMA_REF_REGEX = /\b([A-Z][a-zA-Z0-9_]*)\b/g

export function parseApiHeader(content: string): ParsedApiHeader | null {
  const lines = content.split("\n")
  for (const line of lines) {
    const match = line.match(API_HEADER_REGEX)
    if (match) {
      return {
        title: match[1].trim(),
        defaultUrl: match[2].trim(),
      }
    }
  }
  return null
}

export function parseServers(content: string): Record<string, string> {
  const lines = content.split("\n")
  for (const line of lines) {
    const match = line.match(SERVERS_HEADER_REGEX)
    if (match) {
      const servers: Record<string, string> = {}
      const pairs = match[1].split(",")
      for (const pair of pairs) {
        const [label, url] = pair.trim().split("=")
        if (label && url) {
          servers[label.trim()] = url.trim()
        }
      }
      return servers
    }
  }
  return {}
}

export function stripDeprecationWrapper(method: string): string {
  return method.replace(/^~~|~~$/g, "")
}

export function normalizePath(path: string): string {
  return path.replace(/\{[^}:]+:[^}]+\}/g, (match) => {
    return match.substring(0, match.indexOf(":")) + "}"
  })
}

export function parseEndpointLine(line: string): { method: string; path: string; auth?: string } | null {
  const match = line.match(ENDPOINT_LINE_REGEX)
  if (!match) return null
  
  const method = stripDeprecationWrapper(match[2])
  const path = normalizePath(match[4])
  const auth = match[6]?.trim()
  
  return { method, path, auth: auth || undefined }
}

export function parseEndpoints(content: string): ParsedEndpoint[] {
  const lines = content.split("\n")
  const endpoints: ParsedEndpoint[] = []
  let currentSection: string | null = null
  let inSchemasSection = false
  
  for (const line of lines) {
    if (line.match(/^##\s+Schemas\s*$/i)) {
      inSchemasSection = true
      continue
    }
    
    const sectionMatch = line.match(SECTION_HEADER_REGEX)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      inSchemasSection = false
      continue
    }
    
    if (inSchemasSection) continue
    if (line.startsWith("#")) continue
    
    const endpoint = parseEndpointLine(line)
    if (endpoint && currentSection) {
      endpoints.push({
        ...endpoint,
        section: currentSection,
      })
    }
  }
  
  return endpoints
}

export function findEndpointBlock(content: string, method: string, path: string): string | null {
  const normalizedPath = normalizePath(path)
  const lines = content.split("\n")
  const blockLines: string[] = []
  let inBlock = false
  let foundEndpoint = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const endpoint = parseEndpointLine(line)
    
    if (endpoint) {
      if (endpoint.method === method && endpoint.path === normalizedPath) {
        inBlock = true
        foundEndpoint = true
        blockLines.push(line)
        continue
      } else if (inBlock) {
        break
      }
    }
    
    if (inBlock) {
      if (line.match(/^##\s+/) || line.match(/^(~~)?[A-Z]+(~~)?\s+\//)) {
        break
      }
      blockLines.push(line)
    }
  }
  
  return foundEndpoint ? blockLines.join("\n") : null
}

export function extractSchemaRefs(block: string): string[] {
  const refs = new Set<string>()
  const matches = block.matchAll(SCHEMA_REF_REGEX)
  for (const match of matches) {
    const name = match[1]
    if (name === "OneOf"|| name === "AnyOf" || name === "AllOf" || name === "extends") {
      continue
    }
    refs.add(name)
  }
  return Array.from(refs)
}

export function findSchemaBlock(content: string, schemaName: string): string | null {
  const lines = content.split("\n")
  const schemaRegex = new RegExp(`^${schemaName}:\\s*`)
  let inSchema = false
  let braceDepth = 0
  const blockLines: string[] = []
  
  for (const line of lines) {
    if (line.match(schemaRegex)) {
      inSchema = true
      blockLines.push(line)
      braceDepth += (line.match(/{/g) || []).length
      braceDepth -= (line.match(/}/g) || []).length
      continue
    }
    
    if (inSchema) {
      blockLines.push(line)
      braceDepth += (line.match(/{/g) || []).length
      braceDepth -= (line.match(/}/g) || []).length
      
      if (line.includes(":") && !line.includes("{") && braceDepth === 0) {
        break
      }
      if (braceDepth === 0 && line.trim().endsWith("}")) {
        break
      }
    }
  }
  
  return blockLines.length > 0 ? blockLines.join("\n") : null
}

export function collectSchemas(content: string, endpointBlock: string): string {
  const schemasSection = extractSchemasSection(content)
  const refs = extractSchemaRefs(endpointBlock)
  const collected: string[] = []
  
  for (const ref of refs) {
    const schemaBlock = findSchemaBlock(schemasSection, ref)
    if (schemaBlock) {
      collected.push(schemaBlock)
      const nestedRefs = extractSchemaRefs(schemaBlock)
      for (const nestedRef of nestedRefs) {
        if (!refs.includes(nestedRef)) {
          const nestedBlock = findSchemaBlock(schemasSection, nestedRef)
          if (nestedBlock) {
            collected.push(nestedBlock)
          }
        }
      }
    }
  }
  
  return collected.join("\n\n")
}

function extractSchemasSection(content: string): string {
  const lines = content.split("\n")
  const schemaLines: string[] = []
  let inSchemas = false
  
  for (const line of lines) {
    if (line.match(/^##\s+Schemas\s*$/i)) {
      inSchemas = true
      continue
    }
    if (inSchemas) {
      if (line.match(/^##\s+/)) {
        break
      }
      schemaLines.push(line)
    }
  }
  
  return schemaLines.join("\n")
}

export function parseFullEndpoint(content: string, method: string, path: string): string | null {
  const endpointBlock = findEndpointBlock(content, method, path)
  if (!endpointBlock) return null
  
  const schemas = collectSchemas(content, endpointBlock)
  
  if (schemas) {
    return endpointBlock + "\n\n" + schemas
  }
  
  return endpointBlock
}