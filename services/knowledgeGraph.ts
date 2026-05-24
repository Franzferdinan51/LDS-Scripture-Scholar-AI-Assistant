/**
 * Scripture Knowledge Graph Service
 * Provides semantic search, theme clustering, and relationship mapping for scriptures
 */

interface ScriptureReference {
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number;
}

interface ScriptureNode {
  reference: ScriptureReference;
  text: string;
  themes: string[];
  people: string[];
  places: string[];
  events: string[];
  crossRefs: ScriptureReference[];
  embeddings: number[];
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: 'quote' | 'theme' | 'people' | 'place' | 'event' | 'parallel';
  weight: number;
}

interface QueryPattern {
  themes?: string[];
  people?: string[];
  places?: string[];
  events?: string[];
  textSearch?: string;
}

interface Path {
  nodes: ScriptureNode[];
  edges: GraphEdge[];
  totalWeight: number;
}

export class KnowledgeGraph {
  private nodes: Map<string, ScriptureNode> = new Map();
  private edges: GraphEdge[] = [];
  private themeIndex: Map<string, Set<string>> = new Map();
  private peopleIndex: Map<string, Set<string>> = new Map();
  private placeIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeIndices();
  }

  private initializeIndices(): void {
    // Initialize index maps for fast lookups
  }

  /**
   * Add a scripture node to the graph
   */
  addNode(node: ScriptureNode): void {
    const key = this.referenceToKey(node.reference);
    this.nodes.set(key, node);
    this.updateIndices(key, node);
  }

  /**
   * Add an edge between two scripture nodes
   */
  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);
  }

  /**
   * Query the knowledge graph for matching scriptures
   */
  query(pattern: QueryPattern): ScriptureNode[] {
    const results: Set<string> = new Set();

    if (pattern.themes) {
      for (const theme of pattern.themes) {
        const matching = this.themeIndex.get(theme.toLowerCase());
        if (matching) {
          matching.forEach(key => results.add(key));
        }
      }
    }

    if (pattern.people) {
      for (const person of pattern.people) {
        const matching = this.peopleIndex.get(person.toLowerCase());
        if (matching) {
          matching.forEach(key => results.add(key));
        }
      }
    }

    if (pattern.places) {
      for (const place of pattern.places) {
        const matching = this.placeIndex.get(place.toLowerCase());
        if (matching) {
          matching.forEach(key => results.add(key));
        }
      }
    }

    return Array.from(results)
      .map(key => this.nodes.get(key))
      .filter((node): node is ScriptureNode => node !== undefined);
  }

  /**
   * Find the shortest path between two scriptures
   */
  pathBetween(ref1: ScriptureReference, ref2: ScriptureReference): Path | null {
    const startKey = this.referenceToKey(ref1);
    const endKey = this.referenceToKey(ref2);

    if (!this.nodes.has(startKey) || !this.nodes.has(endKey)) {
      return null;
    }

    // Dijkstra's algorithm for shortest path
    const distances = new Map<string, number>();
    const previous = new Map<string, { node: string; edge: GraphEdge | null }>();
    const unvisited = new Set<string>();

    this.nodes.forEach((_, key) => {
      distances.set(key, Infinity);
      unvisited.add(key);
    });
    distances.set(startKey, 0);

    while (unvisited.size > 0) {
      let current: string | null = null;
      let minDist = Infinity;

      for (const key of unvisited) {
        const dist = distances.get(key) ?? Infinity;
        if (dist < minDist) {
          minDist = dist;
          current = key;
        }
      }

      if (current === null || current === endKey) break;

      unvisited.delete(current);

      // Find neighbors
      const neighbors = this.edges.filter(e => e.source === current || e.target === current);
      for (const edge of neighbors) {
        const neighbor = edge.source === current ? edge.target : edge.source;
        if (!unvisited.has(neighbor)) continue;

        const alt = (distances.get(current) ?? Infinity) + edge.weight;
        if (alt < (distances.get(neighbor) ?? Infinity)) {
          distances.set(neighbor, alt);
          previous.set(neighbor, { node: current, edge });
        }
      }
    }

    // Reconstruct path
    const pathNodes: ScriptureNode[] = [];
    const pathEdges: GraphEdge[] = [];
    let current = endKey;

    while (current && previous.has(current)) {
      const node = this.nodes.get(current);
      if (node) pathNodes.unshift(node);
      const prev = previous.get(current);
      if (prev?.edge) pathEdges.unshift(prev.edge);
      current = prev?.node ?? '';
    }

    const startNode = this.nodes.get(startKey);
    if (startNode) pathNodes.unshift(startNode);

    return {
      nodes: pathNodes,
      edges: pathEdges,
      totalWeight: distances.get(endKey) ?? Infinity
    };
  }

  /**
   * Get all cross references for a scripture
   */
  getCrossReferences(ref: ScriptureReference): ScriptureNode[] {
    const key = this.referenceToKey(ref);
    const node = this.nodes.get(key);
    if (!node) return [];

    return node.crossRefs
      .map(crossRef => this.nodes.get(this.referenceToKey(crossRef)))
      .filter((n): n is ScriptureNode => n !== undefined);
  }

  /**
   * Get all scriptures with a specific theme
   */
  getThematicCluster(theme: string): ScriptureNode[] {
    const keys = this.themeIndex.get(theme.toLowerCase());
    if (!keys) return [];

    return Array.from(keys)
      .map(key => this.nodes.get(key))
      .filter((node): node is ScriptureNode => node !== undefined);
  }

  private referenceToKey(ref: ScriptureReference): string {
    return `${ref.book}:${ref.chapter}:${ref.verse}`;
  }

  private updateIndices(key: string, node: ScriptureNode): void {
    // Update theme index
    for (const theme of node.themes) {
      const lowerTheme = theme.toLowerCase();
      if (!this.themeIndex.has(lowerTheme)) {
        this.themeIndex.set(lowerTheme, new Set());
      }
      this.themeIndex.get(lowerTheme)!.add(key);
    }

    // Update people index
    for (const person of node.people) {
      const lowerPerson = person.toLowerCase();
      if (!this.peopleIndex.has(lowerPerson)) {
        this.peopleIndex.set(lowerPerson, new Set());
      }
      this.peopleIndex.get(lowerPerson)!.add(key);
    }

    // Update place index
    for (const place of node.places) {
      const lowerPlace = place.toLowerCase();
      if (!this.placeIndex.has(lowerPlace)) {
        this.placeIndex.set(lowerPlace, new Set());
      }
      this.placeIndex.get(lowerPlace)!.add(key);
    }
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Semantic search using embeddings
   */
  semanticSearch(queryEmbedding: number[], topK: number = 10): ScriptureNode[] {
    const similarities: Array<{ key: string; similarity: number }> = [];

    this.nodes.forEach((node, key) => {
      if (node.embeddings.length > 0) {
        const similarity = this.cosineSimilarity(queryEmbedding, node.embeddings);
        similarities.push({ key, similarity });
      }
    });

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(({ key }) => this.nodes.get(key))
      .filter((node): node is ScriptureNode => node !== undefined);
  }

  /**
   * Export graph data for visualization
   */
  exportForVisualization(): { nodes: ScriptureNode[]; edges: GraphEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }
}

// Singleton instance
export const knowledgeGraph = new KnowledgeGraph();