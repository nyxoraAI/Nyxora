export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: any;
}

export interface Plugin {
  name: string;
  description: string;
  version: string;
  tools: any[]; // The tools array ready to be sent to Gemini/Anthropic
  handlers: Record<string, (args: any, context?: any) => Promise<any>>;
}
