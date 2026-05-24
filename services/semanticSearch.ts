let featureExtractorPromise: Promise<any> | null = null;
const embeddingCache = new Map<string, number[]>();

async function getFeatureExtractor(): Promise<any> {
  if (!featureExtractorPromise) {
    featureExtractorPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    })();
  }
  return featureExtractorPromise;
}

export async function embedText(text: string): Promise<number[] | null> {
  const normalized = text.trim();
  if (!normalized) return null;

  const cached = embeddingCache.get(normalized);
  if (cached) return cached;

  try {
    const extractor = await getFeatureExtractor();
    const output = await extractor(normalized, {
      pooling: 'mean',
      normalize: true,
    });

    const vector = Array.from(output.data as Float32Array | number[]);
    embeddingCache.set(normalized, vector);
    return vector;
  } catch (error) {
    console.warn('Embedding generation failed, falling back to lexical search:', error);
    return null;
  }
}

export function cosineSimilarity(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function rankBySemanticSimilarity<T extends { text: string; id?: string }>(
  query: string,
  items: T[],
  options: {
    getText?: (item: T) => string;
    limit?: number;
    keywordWeight?: number;
    semanticWeight?: number;
  } = {}
): Promise<Array<T & { score: number }>> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || items.length === 0) return [];

  const queryEmbedding = await embedText(normalizedQuery);
  const queryLower = normalizedQuery.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
  const getText = options.getText ?? ((item: T) => item.text);
  const keywordWeight = options.keywordWeight ?? 0.35;
  const semanticWeight = options.semanticWeight ?? 0.65;

  const scored = await Promise.all(items.map(async (item) => {
    const text = getText(item).trim();
    const lower = text.toLowerCase();
    let keywordScore = 0;

    if (lower.includes(queryLower)) keywordScore += 3;
    for (const word of queryWords) {
      if (lower.includes(word)) keywordScore += 1;
    }

    const itemEmbedding = await embedText(text);
    const semanticScore = cosineSimilarity(queryEmbedding, itemEmbedding);
    const score = (keywordScore * keywordWeight) + (semanticScore * semanticWeight * 5);

    return { ...item, score };
  }));

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? items.length);
}
