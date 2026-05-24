/**
 * Scripture Tools - Built-in tools for the LDS Scripture Scholar Agent
 * These tools provide scripture lookup, cross-referencing, study aids, and planning
 */

import { toolRegistry, ToolDefinition, ToolResult } from './agentToolRegistry';

// Scripture reference data structure
interface ScriptureRef {
  book: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
  text?: string;
}

// Cross-reference data
interface CrossReference {
  from: ScriptureRef;
  to: ScriptureRef;
  relationship: 'parallel' | 'quotation' | 'allusion' | 'topical' | 'doctrinal';
  explanation: string;
}

// Study note structure
interface StudyNote {
  id: string;
  scriptureRef: ScriptureRef;
  note: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Scripture Lookup Tool
 * Retrieves scripture text by reference
 */
export const scriptureLookupTool: ToolDefinition = {
  name: 'scripture_lookup',
  description: 'Look up scripture text by reference (e.g., "1 Nephi 3:7", "D&C 76", "Matthew 5:1-16")',
  category: 'scripture',
  parameters: [
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference (e.g., "1 Nephi 3:7", "Genesis 1")',
      required: true,
    },
    {
      name: 'version',
      type: 'string',
      description: 'Scripture version',
      required: false,
      default: 'current',
      enum: ['current', '1830', 'jst'],
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const reference = parseScriptureReference(params.reference as string);
      if (!reference) {
        return { success: false, error: 'Invalid scripture reference format' };
      }

      // In a real implementation, this would query a scripture database
      // For now, return a structured response
      return {
        success: true,
        data: {
          reference,
          text: `[Scripture text for ${reference.book} ${reference.chapter}${reference.verse ? ':' + reference.verse : ''}]`,
          source: params.version || 'current',
        },
      };
    } catch (error) {
      return { success: false, error: `Failed to lookup scripture: ${error}` };
    }
  },
  examples: [
    {
      description: 'Look up a single verse',
      params: { reference: '1 Nephi 3:7' },
      expectedOutput: 'Returns the text of 1 Nephi 3:7',
    },
    {
      description: 'Look up a chapter',
      params: { reference: '2 Nephi 2' },
      expectedOutput: 'Returns the full text of 2 Nephi chapter 2',
    },
  ],
};

/**
 * Cross-Reference Tool
 * Find cross-references and related scriptures
 */
export const crossReferenceTool: ToolDefinition = {
  name: 'cross_reference',
  description: 'Find cross-references and related scriptures for a given passage',
  category: 'reference',
  parameters: [
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference to find cross-references for',
      required: true,
    },
    {
      name: 'relationship_type',
      type: 'string',
      description: 'Type of cross-reference relationship',
      required: false,
      default: 'all',
      enum: ['all', 'parallel', 'quotation', 'allusion', 'topical', 'doctrinal'],
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of cross-references to return',
      required: false,
      default: 10,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const reference = parseScriptureReference(params.reference as string);
      if (!reference) {
        return { success: false, error: 'Invalid scripture reference format' };
      }

      // In a real implementation, this would query a cross-reference database
      const crossRefs: CrossReference[] = [];

      return {
        success: true,
        data: {
          source: reference,
          crossReferences: crossRefs,
          count: crossRefs.length,
          filter: params.relationship_type || 'all',
        },
      };
    } catch (error) {
      return { success: false, error: `Failed to find cross-references: ${error}` };
    }
  },
  examples: [
    {
      description: 'Find all cross-references for a verse',
      params: { reference: 'John 3:16' },
      expectedOutput: 'Returns list of related scriptures',
    },
  ],
};

/**
 * Topical Search Tool
 * Search scriptures by topic or theme
 */
export const topicalSearchTool: ToolDefinition = {
  name: 'topical_search',
  description: 'Search scriptures by topic, theme, or keyword (e.g., "faith", "atonement", "priesthood")',
  category: 'scripture',
  parameters: [
    {
      name: 'topic',
      type: 'string',
      description: 'Topic or keyword to search for',
      required: true,
    },
    {
      name: 'books',
      type: 'array',
      description: 'Limit search to specific books (e.g., ["Book of Mormon", "D&C"])',
      required: false,
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum results to return',
      required: false,
      default: 20,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const topic = params.topic as string;
      const limit = (params.limit as number) || 20;

      // In a real implementation, this would search a scripture index
      return {
        success: true,
        data: {
          topic,
          results: [],
          totalResults: 0,
          searchedBooks: params.books || 'all',
        },
      };
    } catch (error) {
      return { success: false, error: `Topical search failed: ${error}` };
    }
  },
  examples: [
    {
      description: 'Search for faith-related scriptures',
      params: { topic: 'faith', limit: 10 },
      expectedOutput: 'Returns scriptures about faith',
    },
  ],
};

/**
 * Study Note Tool
 * Create, retrieve, update, or delete study notes
 */
export const studyNoteTool: ToolDefinition = {
  name: 'study_note',
  description: 'Manage study notes for scriptures (create, retrieve, update, delete)',
  category: 'study',
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'Action to perform',
      required: true,
      enum: ['create', 'get', 'update', 'delete', 'list'],
    },
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference for the note',
      required: false,
    },
    {
      name: 'note_id',
      type: 'string',
      description: 'Note ID (for get, update, delete actions)',
      required: false,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Note content (for create and update actions)',
      required: false,
    },
    {
      name: 'tags',
      type: 'array',
      description: 'Tags for categorizing the note',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const action = params.action as string;

      switch (action) {
        case 'create':
          if (!params.reference || !params.content) {
            return { success: false, error: 'Reference and content required for create action' };
          }
          return {
            success: true,
            data: {
              id: `note_${Date.now()}`,
              reference: params.reference,
              content: params.content,
              tags: params.tags || [],
              createdAt: new Date().toISOString(),
            },
          };

        case 'get':
          if (!params.note_id) {
            return { success: false, error: 'Note ID required for get action' };
          }
          return {
            success: true,
            data: { id: params.note_id, message: 'Note retrieved' },
          };

        case 'list':
          return {
            success: true,
            data: { notes: [], total: 0 },
          };

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      return { success: false, error: `Study note operation failed: ${error}` };
    }
  },
};

/**
 * Study Plan Generator Tool
 * Create personalized study plans
 */
export const studyPlanTool: ToolDefinition = {
  name: 'study_plan',
  description: 'Generate a personalized scripture study plan based on goals and interests',
  category: 'planning',
  parameters: [
    {
      name: 'goal',
      type: 'string',
      description: 'Study goal (e.g., "read Book of Mormon in 30 days", "study Atonement")',
      required: true,
    },
    {
      name: 'duration_days',
      type: 'number',
      description: 'Plan duration in days',
      required: false,
      default: 30,
    },
    {
      name: 'daily_minutes',
      type: 'number',
      description: 'Available study time per day in minutes',
      required: false,
      default: 15,
    },
    {
      name: 'focus_areas',
      type: 'array',
      description: 'Specific areas to emphasize',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const goal = params.goal as string;
      const duration = (params.duration_days as number) || 30;
      const dailyMinutes = (params.daily_minutes as number) || 15;

      // In a real implementation, this would generate an actual study plan
      return {
        success: true,
        data: {
          goal,
          duration,
          dailyMinutes,
          totalStudyTime: duration * dailyMinutes,
          plan: [],
          message: 'Study plan generated successfully',
        },
      };
    } catch (error) {
      return { success: false, error: `Study plan generation failed: ${error}` };
    }
  },
  examples: [
    {
      description: 'Create a 30-day Book of Mormon reading plan',
      params: { goal: 'Read Book of Mormon', duration_days: 30, daily_minutes: 20 },
      expectedOutput: 'Returns a day-by-day reading schedule',
    },
  ],
};

/**
 * Context Analysis Tool
 * Analyze the historical and cultural context of a scripture passage
 */
export const contextAnalysisTool: ToolDefinition = {
  name: 'context_analysis',
  description: 'Analyze historical, cultural, and literary context of a scripture passage',
  category: 'study',
  parameters: [
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference to analyze',
      required: true,
    },
    {
      name: 'analysis_type',
      type: 'string',
      description: 'Type of context analysis',
      required: false,
      default: 'comprehensive',
      enum: ['comprehensive', 'historical', 'cultural', 'literary', 'doctrinal'],
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const reference = parseScriptureReference(params.reference as string);
      if (!reference) {
        return { success: false, error: 'Invalid scripture reference format' };
      }

      return {
        success: true,
        data: {
          reference,
          analysisType: params.analysis_type || 'comprehensive',
          historicalContext: {},
          culturalContext: {},
          literaryContext: {},
          doctrinalContext: {},
        },
      };
    } catch (error) {
      return { success: false, error: `Context analysis failed: ${error}` };
    }
  },
};

/**
 * Quiz Generator Tool
 * Generate study quizzes from scripture passages
 */
export const quizGeneratorTool: ToolDefinition = {
  name: 'quiz_generator',
  description: 'Generate study quizzes from scripture passages for self-assessment',
  category: 'study',
  parameters: [
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference to create quiz from',
      required: true,
    },
    {
      name: 'difficulty',
      type: 'string',
      description: 'Quiz difficulty level',
      required: false,
      default: 'medium',
      enum: ['easy', 'medium', 'hard'],
    },
    {
      name: 'question_count',
      type: 'number',
      description: 'Number of questions to generate',
      required: false,
      default: 5,
    },
    {
      name: 'question_types',
      type: 'array',
      description: 'Types of questions (multiple_choice, fill_blank, short_answer)',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const reference = parseScriptureReference(params.reference as string);
      if (!reference) {
        return { success: false, error: 'Invalid scripture reference format' };
      }

      const questionCount = (params.question_count as number) || 5;

      return {
        success: true,
        data: {
          reference,
          difficulty: params.difficulty || 'medium',
          questions: [],
          totalQuestions: questionCount,
        },
      };
    } catch (error) {
      return { success: false, error: `Quiz generation failed: ${error}` };
    }
  },
};

/**
 * Parallel Passages Tool
 * Find parallel passages across different standard works
 */
export const parallelPassagesTool: ToolDefinition = {
  name: 'parallel_passages',
  description: 'Find parallel passages and similar teachings across different standard works',
  category: 'reference',
  parameters: [
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference to find parallels for',
      required: true,
    },
    {
      name: 'works',
      type: 'array',
      description: 'Specific works to search (e.g., ["Bible", "Book of Mormon"])',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const reference = parseScriptureReference(params.reference as string);
      if (!reference) {
        return { success: false, error: 'Invalid scripture reference format' };
      }

      return {
        success: true,
        data: {
          source: reference,
          parallels: [],
          worksSearched: params.works || ['all'],
        },
      };
    } catch (error) {
      return { success: false, error: `Parallel passages search failed: ${error}` };
    }
  },
};

/**
 * Hebrew/Greek Word Study Tool
 * Look up original language meanings
 */
export const wordStudyTool: ToolDefinition = {
  name: 'word_study',
  description: 'Study Hebrew/Greek meanings of words in scripture passages',
  category: 'study',
  parameters: [
    {
      name: 'word',
      type: 'string',
      description: 'English word to study',
      required: true,
    },
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference where the word appears',
      required: false,
    },
    {
      name: 'language',
      type: 'string',
      description: 'Original language to study',
      required: false,
      default: 'auto',
      enum: ['auto', 'hebrew', 'greek'],
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const word = params.word as string;

      return {
        success: true,
        data: {
          word,
          reference: params.reference || null,
          language: params.language || 'auto',
          definitions: [],
          relatedWords: [],
          usageExamples: [],
        },
      };
    } catch (error) {
      return { success: false, error: `Word study failed: ${error}` };
    }
  },
};

/**
 * FHE (Family Home Evening) Planner Tool
 * Generate FHE lesson plans based on scriptures
 */
export const fhePlannerTool: ToolDefinition = {
  name: 'fhe_planner',
  description: 'Generate Family Home Evening lesson plans based on scripture passages',
  category: 'planning',
  parameters: [
    {
      name: 'topic',
      type: 'string',
      description: 'Topic or scripture for the FHE lesson',
      required: true,
    },
    {
      name: 'age_group',
      type: 'string',
      description: 'Age group for the lesson',
      required: false,
      default: 'family',
      enum: ['children', 'youth', 'adults', 'family', 'mixed'],
    },
    {
      name: 'duration_minutes',
      type: 'number',
      description: 'Lesson duration in minutes',
      required: false,
      default: 30,
    },
    {
      name: 'include_activities',
      type: 'boolean',
      description: 'Whether to include activities and games',
      required: false,
      default: true,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const topic = params.topic as string;

      return {
        success: true,
        data: {
          topic,
          ageGroup: params.age_group || 'family',
          duration: params.duration_minutes || 30,
          lesson: {
            opening: {},
            lesson: {},
            activities: params.include_activities !== false ? [] : null,
            closing: {},
          },
        },
      };
    } catch (error) {
      return { success: false, error: `FHE planner failed: ${error}` };
    }
  },
};

/**
 * Daily Scripture Recommendation Tool
 * Get personalized daily scripture recommendations
 */
export const dailyRecommendationTool: ToolDefinition = {
  name: 'daily_recommendation',
  description: 'Get personalized daily scripture recommendations based on study history and needs',
  category: 'study',
  parameters: [
    {
      name: 'focus',
      type: 'string',
      description: 'Optional focus area for recommendations',
      required: false,
    },
    {
      name: 'mood',
      type: 'string',
      description: 'Current mood or need (e.g., "comfort", "guidance", "gratitude")',
      required: false,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      return {
        success: true,
        data: {
          date: new Date().toISOString().split('T')[0],
          recommendations: [],
          focus: params.focus || 'general',
          mood: params.mood || null,
        },
      };
    } catch (error) {
      return { success: false, error: `Daily recommendation failed: ${error}` };
    }
  },
};

/**
 * Lesson Preparation Tool
 * Help prepare lessons from church curriculum
 */
export const lessonPrepTool: ToolDefinition = {
  name: 'lesson_prep',
  description: 'Help prepare lessons from Come Follow Me or other church curriculum',
  category: 'planning',
  parameters: [
    {
      name: 'curriculum',
      type: 'string',
      description: 'Curriculum source',
      required: true,
      enum: ['come_follow_me', 'general_conference', 'primary', 'youth', 'seminary', 'institute'],
    },
    {
      name: 'date',
      type: 'string',
      description: 'Date or week for the lesson (YYYY-MM-DD or "next week")',
      required: false,
    },
    {
      name: 'audience',
      type: 'string',
      description: 'Target audience',
      required: false,
      default: 'general',
      enum: ['general', 'youth', 'children', 'new_members', 'advanced'],
    },
    {
      name: 'lesson_length',
      type: 'number',
      description: 'Lesson length in minutes',
      required: false,
      default: 40,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const curriculum = params.curriculum as string;

      return {
        success: true,
        data: {
          curriculum,
          date: params.date || 'upcoming',
          audience: params.audience || 'general',
          lessonLength: params.lesson_length || 40,
          outline: {},
          resources: [],
          discussionQuestions: [],
        },
      };
    } catch (error) {
      return { success: false, error: `Lesson preparation failed: ${error}` };
    }
  },
};

/**
 * Scripture Chain Tool
 * Follow chains of references and teachings
 */
export const scriptureChainTool: ToolDefinition = {
  name: 'scripture_chain',
  description: 'Build and follow chains of related scripture references on a topic',
  category: 'reference',
  parameters: [
    {
      name: 'starting_point',
      type: 'string',
      description: 'Starting scripture reference',
      required: true,
    },
    {
      name: 'topic',
      type: 'string',
      description: 'Topic or theme to follow',
      required: true,
    },
    {
      name: 'max_depth',
      type: 'number',
      description: 'Maximum depth of the reference chain',
      required: false,
      default: 5,
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const reference = parseScriptureReference(params.starting_point as string);
      if (!reference) {
        return { success: false, error: 'Invalid scripture reference format' };
      }

      return {
        success: true,
        data: {
          startingPoint: reference,
          topic: params.topic,
          chain: [],
          maxDepth: params.max_depth || 5,
        },
      };
    } catch (error) {
      return { success: false, error: `Scripture chain failed: ${error}` };
    }
  },
};

/**
 * Map Tool
 * Get geographical context for scripture events
 */
export const scriptureMapTool: ToolDefinition = {
  name: 'scripture_map',
  description: 'Get geographical context and locations for scripture events',
  category: 'reference',
  parameters: [
    {
      name: 'reference',
      type: 'string',
      description: 'Scripture reference to get map for',
      required: true,
    },
    {
      name: 'map_type',
      type: 'string',
      description: 'Type of map information',
      required: false,
      default: 'locations',
      enum: ['locations', 'journeys', 'battles', 'settlements'],
    },
  ],
  execute: async (params): Promise<ToolResult> => {
    try {
      const reference = parseScriptureReference(params.reference as string);
      if (!reference) {
        return { success: false, error: 'Invalid scripture reference format' };
      }

      return {
        success: true,
        data: {
          reference,
          mapType: params.map_type || 'locations',
          locations: [],
          coordinates: null,
        },
      };
    } catch (error) {
      return { success: false, error: `Scripture map failed: ${error}` };
    }
  },
};

/**
 * Helper function to parse scripture references
 */
function parseScriptureReference(ref: string): ScriptureRef | null {
  // Simple regex-based parsing
  const patterns = [
    // "1 Nephi 3:7"
    /^(\d?\s*\w+(?:\s+\w+)?)\s+(\d+):(\d+)(?:-(\d+))?$/,
    // "2 Nephi 2" (chapter only)
    /^(\d?\s*\w+(?:\s+\w+)?)\s+(\d+)$/,
    // "D&C 76:1-3"
    /^(\w+&?\w*)\s+(\d+):(\d+)(?:-(\d+))?$/,
  ];

  for (const pattern of patterns) {
    const match = ref.match(pattern);
    if (match) {
      return {
        book: match[1].trim(),
        chapter: parseInt(match[2], 10),
        verse: match[3] ? parseInt(match[3], 10) : undefined,
        endVerse: match[4] ? parseInt(match[4], 10) : undefined,
      };
    }
  }

  // Fallback: try to extract book and chapter
  const simpleMatch = ref.match(/^(.+?)\s+(\d+)$/);
  if (simpleMatch) {
    return {
      book: simpleMatch[1].trim(),
      chapter: parseInt(simpleMatch[2], 10),
    };
  }

  return null;
}

/**
 * Register all scripture tools with the registry
 */
export function registerScriptureTools(): void {
  const tools: ToolDefinition[] = [
    scriptureLookupTool,
    crossReferenceTool,
    topicalSearchTool,
    studyNoteTool,
    studyPlanTool,
    contextAnalysisTool,
    quizGeneratorTool,
    parallelPassagesTool,
    wordStudyTool,
    fhePlannerTool,
    dailyRecommendationTool,
    lessonPrepTool,
    scriptureChainTool,
    scriptureMapTool,
  ];

  toolRegistry.registerBatch(tools);
  console.log(`Registered ${tools.length} scripture tools`);
}
