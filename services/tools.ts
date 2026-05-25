import { Type } from '@google/genai';

// --- Tool Definitions for Gemini Function Calling ---

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any; // Gemini Schema
}

// --- Convert Gemini Type enum to OpenAI JSON Schema type strings ---

function geminiTypeToOpenAI(type: any): string {
  if (type === Type.STRING) return 'string';
  if (type === Type.NUMBER) return 'number';
  if (type === Type.BOOLEAN) return 'boolean';
  if (type === Type.OBJECT) return 'object';
  if (type === Type.ARRAY) return 'array';
  return 'string';
}

function convertGeminiParamsToOpenAI(params: any): any {
  if (!params) return {};
  const result: any = { type: 'object', properties: {}, required: params.required || [] };
  if (params.properties) {
    for (const [key, prop] of Object.entries(params.properties) as [string, any][]) {
      result.properties[key] = {
        type: geminiTypeToOpenAI(prop.type),
        description: prop.description || '',
      };
    }
  }
  return result;
}

export { convertGeminiParamsToOpenAI };

// --- OpenAI Function Format ---

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export function getOpenAIToolDeclarations(): OpenAITool[] {
  return SCRIPTURE_TOOLS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: convertGeminiParamsToOpenAI(tool.parameters),
    },
  }));
}

// --- Gemini Function Declarations ---

export const SCRIPTURE_TOOLS: ToolDefinition[] = [
  {
    name: 'searchScriptures',
    description: 'Search across all standard works (Bible, Book of Mormon, Doctrine and Covenants, Pearl of Great Price) for passages matching a query. Returns matching verses with references.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search terms or phrase to find in scripture text',
        },
        books: {
          type: Type.STRING,
          description: 'Optional: comma-separated list of books to search within (e.g., "Book of Mormon, New Testament")',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of results to return (default 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getCrossReferences',
    description: 'Find cross-references and related verses for a given scripture. Returns related scriptures with explanations of how they connect.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scripture: {
          type: Type.STRING,
          description: 'Scripture reference to find cross-references for (e.g., "John 3:16", "2 Nephi 2:25")',
        },
      },
      required: ['scripture'],
    },
  },
  {
    name: 'getScriptureText',
    description: 'Get the full text of a specific scripture verse or chapter from the standard works. Provide a reference like "2 Nephi 2:25", "Alma 32", or "D&C 76".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reference: {
          type: Type.STRING,
          description: 'Scripture reference (e.g., "2 Nephi 2:25", "Alma 32", "D&C 76")',
        },
      },
      required: ['reference'],
    },
  },
  {
    name: 'searchWeb',
    description: 'Search authoritative LDS sources including ChurchofJesusChrist.org Gospel Library, General Conference talks, Church magazines, Book of Mormon Central, FAIR LDS, and other official Church sources. Also searches LDS-domain-filtered web results. Use this for any current Church information, recent talks, official statements, doctrine, or LDS news. This is the primary search tool — it combines multiple sources for maximum coverage.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search query for LDS/Church information',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of results to return (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'searchWikimediaImage',
    description: 'Search Wikimedia Commons for images related to LDS Church history, temples, people, places, or artifacts. Returns image filename and URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Image search query (e.g., "Salt Lake Temple", "Joseph Smith", "Book of Mormon")',
        },
      },
      required: ['query'],
    },
  },
];
/**
 * Returns the Gemini tools array for use in chat configuration.
 * Each entry contains a `name`, `description`, and `parameters` schema
 * compatible with the @google/genai function calling API.
 */
export function getGeminiToolDeclarations(): ToolDefinition[] {
  return SCRIPTURE_TOOLS;
}
