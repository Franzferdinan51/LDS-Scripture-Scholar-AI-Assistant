/**
 * LDS Search Service - RE-EXPORT SHIM
 * All functionality has been merged into webSearchService.ts
 * This file exists for backwards compatibility only.
 */
export {
  searchLDS,
  searchLDSSources,
  searchLdsWeb,
  searchLDSContent,
  webSearch,
  getSearchConfig,
  type WebSearchSettings,
  type WebSearchResult,
  type LDSSearchResult,
  type SearchProviderConfig,
} from './webSearchService';
