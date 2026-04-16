import type { EndpointIndex, ApiMeta, EndpointEntry, InitOptions, GetEndpointSchemaResult, CallContextResult } from "./types"
import { parseApiHeader, parseServers, parseEndpoints } from "./parser"

let indexPromise: Promise<EndpointIndex> | null = null
let currentSpecsDirs: string[] | null = null

export async function initIndex(options: InitOptions): Promise<EndpointIndex> {
  currentSpecsDirs = options.specsDirs
  indexPromise = buildIndex(options.specsDirs)
  return indexPromise
}

export async function getIndex(): Promise<EndpointIndex> {
  if (!indexPromise) {
    throw new Error("Index not initialized. Call initIndex() first.")
  }
  return indexPromise
}

export function clearIndex(): void {
  indexPromise = null
  currentSpecsDirs = null
}

export function getSpecsDirs(): string[] | null {
  return currentSpecsDirs
}

export async function rebuildIndex(): Promise<EndpointIndex> {
  if (!currentSpecsDirs) {
    throw new Error("No specs directories configured. Call initIndex() first.")
  }
  return initIndex({ specsDirs: currentSpecsDirs })
}

async function buildIndex(specsDirs: string[]): Promise<EndpointIndex> {
  const files = (await Promise.all(specsDirs.map(scanMindFiles))).flat()
  const apis: Record<string, ApiMeta> = {}
  const allEndpoints: EndpointEntry[] = []
  const allEnvironments = new Set<string>()
  
  await Promise.all(files.map(async (filePath) => {
    const content = await readFile(filePath)
    const apiName = extractApiName(filePath)
    
    const apiHeader = parseApiHeader(content)
    if (!apiHeader) {
      console.error(`[api-mind] No API header found in ${filePath}`)
      return
    }
    
    const servers = parseServers(content)
    const parsedEndpoints = parseEndpoints(content)
    const endpoints: EndpointEntry[] = parsedEndpoints.map(ep => ({
      api: apiName,
      section: ep.section,
      method: ep.method,
      path: ep.path,
      auth: ep.auth,
    }))
    
    apis[apiName] = {
      filePath,
      title: apiHeader.title,
      defaultUrl: apiHeader.defaultUrl,
      servers,
    }
    
    allEndpoints.push(...endpoints)
    
    Object.keys(servers).forEach(env => allEnvironments.add(env.toLowerCase()))
  }))
  
  return {
    environments: Array.from(allEnvironments).sort(),
    apis,
    endpoints: allEndpoints,
  }
}

async function scanMindFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readDir(dir)
    return entries
      .filter(entry => entry.endsWith(".mind"))
      .map(entry => joinPath(dir, entry))
  } catch {
    console.debug(`[api-mind] Directory not found: ${dir}`)
    return []
  }
}

function extractApiName(filePath: string): string {
  const fileName = filePath.split("/").pop() || ""
  return fileName.replace(/\.mind$/, "")
}

export async function listApis(): Promise<{ apis: Array<{ name: string; title: string; defaultUrl: string; environments: Record<string, string> }> }> {
  const index = await getIndex()
  const apis = Object.entries(index.apis).map(([name, meta]) => ({
    name,
    title: meta.title,
    defaultUrl: meta.defaultUrl,
    environments: meta.servers,
  }))
  return { apis }
}

export async function listEndpoints(filter?: string): Promise<{ environments: string[]; endpoints: EndpointEntry[] }> {
  const index = await getIndex()
  let endpoints = index.endpoints
  
  if (filter) {
    const lowerFilter = filter.toLowerCase()
    endpoints = endpoints.filter(ep =>
      ep.api.toLowerCase().includes(lowerFilter) ||
      ep.method.toLowerCase().includes(lowerFilter) ||
      ep.path.toLowerCase().includes(lowerFilter) ||
      ep.section.toLowerCase().includes(lowerFilter)
    )
  }
  
  return {
    environments: index.environments,
    endpoints,
  }
}

export async function getEndpointSchema(api: string, method: string, path: string): Promise<GetEndpointSchemaResult> {
  const index = await getIndex()
  const apiMeta = index.apis[api]
  
  if (!apiMeta) {
    throw new Error(`API "${api}" not found. Available: ${Object.keys(index.apis).join(", ")}`)
  }
  
  const content = await readFile(apiMeta.filePath)
  const { parseFullEndpoint } = await import("./parser")
  const block = parseFullEndpoint(content, method, path)
  
  if (!block) {
    throw new Error(`Endpoint ${method} ${path} not found in API "${api}"`)
  }
  
  const endpoint = index.endpoints.find(
    ep => ep.api === api && ep.method === method && ep.path === path
  )
  
  return {
    api,
    title: apiMeta.title,
    defaultUrl: apiMeta.defaultUrl,
    environments: apiMeta.servers,
    method,
    path,
    auth: endpoint?.auth || null,
    schema: block,
  }
}

export async function getCallContext(api: string, env?: string): Promise<CallContextResult> {
  const index = await getIndex()
  const apiMeta = index.apis[api]

  if (!apiMeta) {
    throw new Error(`API "${api}" not found. Available: ${Object.keys(index.apis).join(", ")}`)
  }

  const homeDir = process.env.HOME || ""
  const configDir = joinPath(homeDir, ".config", "api-mind")
  const activeEnv = env ?? "dev"
  const defaults: Record<string, string> = {}

  try {
    parseEnvFile(await readFile(joinPath(configDir, `${activeEnv}.env`)), defaults)
  } catch { /* no base env file */ }

  try {
    parseEnvFile(await readFile(joinPath(configDir, api, `${activeEnv}.env`)), defaults)
  } catch { /* no api-specific env file */ }

  const baseUrl = defaults.base_url ?? apiMeta.servers[activeEnv] ?? apiMeta.defaultUrl

  return { api, env: activeEnv, baseUrl, defaults }
}

function parseEnvFile(content: string, target: Record<string, string>): void {
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    target[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
  }
}

let _readFile: ((path: string) => Promise<string>) | null = null
let _readDir: ((dir: string) => Promise<string[]>) | null = null
let _joinPath: ((...parts: string[]) => string) | null = null

export function setFileReader(fn: (path: string) => Promise<string>): void {
  _readFile = fn
}

export function setDirReader(fn: (dir: string) => Promise<string[]>): void {
  _readDir = fn
}

export function setPathJoiner(fn: (...parts: string[]) => string): void {
  _joinPath = fn
}

async function readFile(path: string): Promise<string> {
  if (_readFile) {
    return _readFile(path)
  }
  const fs = await import("fs/promises")
  return fs.readFile(path, "utf-8")
}

async function readDir(dir: string): Promise<string[]> {
  if (_readDir) {
    return _readDir(dir)
  }
  const fs = await import("fs/promises")
  const entries = await fs.readdir(dir)
  return entries
}

function joinPath(...parts: string[]): string {
  if (_joinPath) {
    return _joinPath(...parts)
  }
  return parts.join("/").replace(/\/+/g, "/")
}