import { Type } from '@google/genai';

// --- Tool Definitions for Gemini Function Calling ---

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any; // Gemini Schema
}

/** Metadata for UI display of a tool */
export interface ToolDisplayDefinition {
  name: string;
  description: string;
  icon: string;
  category: 'scripture' | 'search' | 'media' | 'reference';
}

// --- Gemini Function Declarations ---

export const SCRIPTURE_TOOLS: ToolDefinition[] = [
  {
    name: 'searchScriptures',
    description: 'Search across all LDS scriptures (Bible, Book of Mormon, Doctrine and Covenants, Pearl of Great Price) for passages matching a query. Returns matching verses with references.',
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
    description: 'Get the full text of a specific scripture verse or chapter. Provide a reference like "2 Nephi 2:25" or "Alma 32" or "D&C 76".',
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
    description: 'Search the web for current LDS-related information including General Conference talks, news from ChurchofJesusChrist.org, and other official sources.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search query for web search',
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

/** Alias for the Gemini function declarations array (for clarity in imports) */
export const TOOL_DECLARATIONS = SCRIPTURE_TOOLS;

/** UI display metadata for each tool */
export const TOOL_DEFINITIONS: ToolDisplayDefinition[] = [
  {
    name: 'searchScriptures',
    description: 'Search across all LDS scriptures for passages matching a query',
    icon: '🔍',
    category: 'scripture',
  },
  {
    name: 'getCrossReferences',
    description: 'Find cross-references for a scripture reference',
    icon: '🔗',
    category: 'reference',
  },
  {
    name: 'getScriptureText',
    description: 'Get full text of a specific verse or chapter',
    icon: '📖',
    category: 'scripture',
  },
  {
    name: 'searchWeb',
    description: 'Search the web for current LDS information',
    icon: '🌐',
    category: 'search',
  },
  {
    name: 'searchWikimediaImage',
    description: 'Search Wikimedia Commons for LDS images',
    icon: '🖼',
    category: 'media',
  },
];

// --- Accessor Functions ---

/**
 * Returns the Gemini tools array for use in chat configuration.
 * Each entry contains a `name`, `description`, and `parameters` schema
 * compatible with the @google/genai function calling API.
 */
export function getGeminiToolDeclarations(): ToolDefinition[] {
  return SCRIPTURE_TOOLS;
}

/**
 * Returns a tool display definition by its name, or undefined if not found.
 */
export function getToolByName(name: string): ToolDisplayDefinition | undefined {
  return TOOL_DEFINITIONS.find(t => t.name === name);
}

/**
 * Returns all tool display definitions for a given category.
 */
export function getToolsByCategory(category: ToolDisplayDefinition['category']): ToolDisplayDefinition[] {
  return TOOL_DEFINITIONS.filter(t => t.category === category);
}

/**
 * Get the subset of tool definitions that a given skill requires.
 */
export function getToolsForSkill(skillToolNames: string[]): ToolDefinition[] {
  return SCRIPTURE_TOOLS.filter(t => skillToolNames.includes(t.name));
}
