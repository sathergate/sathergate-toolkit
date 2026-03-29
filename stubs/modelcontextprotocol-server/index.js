export class McpServer {
  constructor(o) {
    this._meta = o;
    this._tools = new Map();
  }
  tool(name, description, schema, handler) {
    this._tools.set(name, { name, description, schema, handler });
  }
  getTools() {
    return Array.from(this._tools.values());
  }
  getTool(name) {
    return this._tools.get(name) ?? null;
  }
  get meta() {
    return this._meta;
  }
  async run() {}
  async close() {}
}
