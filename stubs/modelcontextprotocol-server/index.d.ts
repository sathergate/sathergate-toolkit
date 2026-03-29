export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, any>;
  handler: (params: any) => Promise<any>;
}

export interface McpServerMeta {
  name: string;
  version: string;
  description?: string;
}

export declare class McpServer {
  constructor(options: McpServerMeta);
  tool(name: string, description: string, schema: Record<string, any>, handler: (params: any) => Promise<any>): void;
  getTools(): ToolDefinition[];
  getTool(name: string): ToolDefinition | null;
  get meta(): McpServerMeta;
  run(): Promise<void>;
  close(): Promise<void>;
}
