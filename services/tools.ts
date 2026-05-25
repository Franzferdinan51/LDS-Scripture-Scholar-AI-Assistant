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
    description: 'Search official Church of Jesus Christ of Latter-day Saints sources for current information. Searches ChurchofJesusChrist.org Gospel Library, General Conference talks, Church magazines, and authoritative LDS sources. Use this for recent Church information, talks, news, and official statements.',
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
    name: 'searchLDSSources',
    description: 'Search directly on ChurchofJesusChrist.org for official LDS Church content including General Conference talks, scripture study helps, Church manuals, and official publications. Use this when you need the most authoritative, current, and doctrinally accurate information from the Church of Jesus Christ of Latter-day Saints.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search query for official LDS Church sources',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of results to return (default 8)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'searchLdsWeb',
    description: 'Search multiple authoritative LDS sources including ChurchofJesusChrist.org, Book of Mormon Central, and FAIR LDS for scholarly and official information. Combines Gospel Library API results with LDS-domain-filtered web search for maximum coverage of authoritative Latter-day Saints content.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search query for LDS information across multiple authoritative sources',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of results to return (default 8)',
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
