export {
  createChatService,
  createChatServiceWithFailover,
  connectLive,
  generateSpeech,
  getJournalInsights,
  getProactiveSuggestion,
  getWikimediaImageUrl,
  fetchModels,
  testMCPConnection,
  getCrossReferences,
  executeToolWithRetry,
} from './geminiService';

export type {
  ChatServiceOptions,
} from './geminiService';
