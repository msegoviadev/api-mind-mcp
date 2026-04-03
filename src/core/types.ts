export interface ApiMeta {
  filePath: string
  title: string
  defaultUrl: string
  servers: Record<string, string>
}

export interface EndpointEntry {
  api: string
  section: string
  method: string
  path: string
  auth?: string
}

export interface EndpointIndex {
  environments: string[]
  apis: Record<string, ApiMeta>
  endpoints: EndpointEntry[]
}

export interface ApiInfo {
  name: string
  title: string
  defaultUrl: string
  environments: Record<string, string>
}

export interface ListApisResult {
  apis: ApiInfo[]
}

export interface ListEndpointsResult {
  environments: string[]
  endpoints: EndpointEntry[]
}

export interface InitOptions {
  specsDir: string
}

export interface ParsedApiHeader {
  title: string
  defaultUrl: string
}

export interface ParsedEndpoint {
  method: string
  path: string
  auth?: string
  section: string
}

export interface GetEndpointSchemaResult {
  api: string
  title: string
  defaultUrl: string
  environments: Record<string, string>
  method: string
  path: string
  auth: string | null
  schema: string
}