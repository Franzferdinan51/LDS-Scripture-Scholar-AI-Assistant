/**
 * Agent Tool Registry - Dynamic tool management for the LDS Scripture Scholar Agent
 * Inspired by Hermes Agent and OpenClaw patterns
 */

// Tool parameter definition
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Tool example for documentation and testing
export interface ToolExample {
  description: string;
  params: Record<string, any>;
  expectedOutput: any;
}

// Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>) => Promise<ToolResult>;
  examples?: ToolExample[];
  permissions?: string[];
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

// Tool execution history entry
interface ToolExecutionHistory {
  toolName: string;
  params: Record<string, any>;
  result: ToolResult;
  timestamp: Date;
  duration: number;
}

/**
 * Tool Registry - Central manager for all agent tools
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private executionHistory: ToolExecutionHistory[] = [];
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Register a new tool
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool '${tool.name}' is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    console.log(`Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools at once
   */
  registerBatch(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.register(tool));
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): ToolDefinition[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    const categories = new Set(this.getAllTools().map(tool => tool.category));
    return Array.from(categories);
  }

  /**
   * Check rate limits for a tool
   */
  private checkRateLimit(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool?.rateLimit) return true;

    const now = Date.now();
    const counter = this.rateLimitCounters.get(toolName);

    if (!counter || now > counter.resetTime) {
      this.rateLimitCounters.set(toolName, {
        count: 1,
        resetTime: now + tool.rateLimit.windowMs,
      });
      return true;
    }

    if (counter.count >= tool.rateLimit.maxCalls) {
      return false;
    }

    counter.count++;
    return true;
  }

  /**
   * Execute a tool with validation and history tracking
   */
  async executeTool(name: string, params: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    // Check rate limits
    if (!this.checkRateLimit(name)) {
      return {
        success: false,
        error: `Rate limit exceeded for tool '${name}'`,
      };
    }

    // Validate parameters
    const validation = this.validateParams(tool, params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid parameters: ${validation.errors.join(', ')}`,
      };
    }

    // Apply defaults
    const paramsWithDefaults = this.applyDefaults(tool, params);

    // Execute with timing
    const startTime = Date.now();
    try {
      const result = await tool.execute(paramsWithDefaults);
      const duration = Date.now() - startTime;

      // Track execution
      this.executionHistory.push({
        toolName: name,
        params,
        result,
        timestamp: new Date(),
        duration,
      });

      // Keep history manageable
      if (this.executionHistory.length > 1000) {
        this.executionHistory = this.executionHistory.slice(-500);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: ToolResult = {
        success: false,
        error: `Tool execution failed: ${error}`,
      };

      this.executionHistory.push({
        toolName: name,
        params,
        result: errorResult,
        timestamp: new Date(),
        duration,
      });

      return errorResult;
    }
  }

  /**
   * Validate tool parameters
   */
  private validateParams(tool: ToolDefinition, params: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    }

    // Check parameter types
    for (const [key, value] of Object.entries(params)) {
      const paramDef = tool.parameters.find(p => p.name === key);
      if (!paramDef) {
        // Allow extra parameters for flexibility
        continue;
      }

      if (value !== null && value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== paramDef.type && paramDef.type !== 'object') {
          errors.push(`Parameter '${key}' should be ${paramDef.type}, got ${actualType}`);
        }

        if (paramDef.enum && !paramDef.enum.includes(value)) {
          errors.push(`Parameter '${key}' must be one of: ${paramDef.enum.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Apply default values to parameters
   */
  private applyDefaults(tool: ToolDefinition, params: Record<string, any>): Record<string, any> {
    const result = { ...params };

    for (const param of tool.parameters) {
      if (!(param.name in result) && param.default !== undefined) {
        result[param.name] = param.default;
      }
    }

    return result;
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): ToolExecutionHistory[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Get tool usage statistics
   */
  getStats(): Record<string, { calls: number; avgDuration: number; successRate: number }> {
    const stats: Record<string, { calls: number; totalDuration: number; successes: number }> = {};

    for (const entry of this.executionHistory) {
      if (!stats[entry.toolName]) {
        stats[entry.toolName] = { calls: 0, totalDuration: 0, successes: 0 };
      }
      stats[entry.toolName].calls++;
      stats[entry.toolName].totalDuration += entry.duration;
      if (entry.result.success) {
        stats[entry.toolName].successes++;
      }
    }

    const result: Record<string, { calls: number; avgDuration: number; successRate: number }> = {};
    for (const [name, data] of Object.entries(stats)) {
      result[name] = {
        calls: data.calls,
        avgDuration: data.totalDuration / data.calls,
        successRate: data.successes / data.calls,
      };
    }

    return result;
  }

  /**
   * Generate tool documentation
   */
  generateDocs(): string {
    const categories = this.getCategories();
    let docs = '# Agent Tools Documentation\n\n';

    for (const category of categories) {
      docs += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Tools\n\n`;
      const tools = this.getToolsByCategory(category);

      for (const tool of tools) {
        docs += `### ${tool.name}\n`;
        docs += `${tool.description}\n\n`;
        docs += `**Parameters:**\n`;

        for (const param of tool.parameters) {
          const required = param.required ? '(required)' : '(optional)';
          docs += `- \`${param.name}\` ${required}: ${param.description}\n`;
        }

        if (tool.examples?.length) {
          docs += `\n**Example:**\n`;
          docs += `> ${tool.examples[0].description}\n`;
          docs += `> Input: \`${JSON.stringify(tool.examples[0].params)}\`\n`;
        }

        docs += '\n';
      }
    }

    return docs;
  }

  /**
   * Export tools as Gemini-compatible function declarations
   */
  toGeminiDeclarations(): any[] {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.parameters.map(p => [
            p.name,
            {
              type: p.type === 'array' ? 'array' : p.type,
              description: p.description,
              ...(p.enum && { enum: p.enum }),
              ...(p.default !== undefined && { default: p.default }),
            },
          ])
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    }));
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
