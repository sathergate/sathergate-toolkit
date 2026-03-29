export declare class McpServer {
  constructor(options: { name: string; version: string; description?: string });
  tool(name: string, description: string, schema: Record<string, any>, handler: (params: any) => Promise<any>): void;
  run(): Promise<void>;
  close(): Promise<void>;
}
