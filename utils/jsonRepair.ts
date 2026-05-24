/**
 * Robust JSON extraction and repair from LLM outputs.
 * Handles: thinking blocks, markdown fences, trailing commas,
 * missing commas, unescaped newlines, unbalanced braces.
 */

// Remove  blocks from reasoning models
function stripThinkingBlocks(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}

// Extract JSON from markdown fences or raw text
function extractJSON(text: string): string {
  // Try ```json ... ``` first
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();

  // Try to find raw JSON object or array
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');

  if (objStart === -1 && arrStart === -1) return text.trim();

  const start = objStart === -1 ? arrStart :
                arrStart === -1 ? objStart :
                Math.min(objStart, arrStart);

  // Find matching closing bracket
  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;

  for (let i = start; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    if (text[i] === closeChar) depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }

  return text.slice(start);
}

// Repair common JSON issues
function repairJSON(text: string): string {
  let repaired = text;

  // Fix trailing commas before } or ]
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Fix missing commas between objects on separate lines
  repaired = repaired.replace(/}\s*\n\s*{/g, '},\n{');
  repaired = repaired.replace(/}\s*\n\s*\[/g, '},\n[');

  // Fix missing commas after string values before new key
  repaired = repaired.replace(/"\s*\n\s*"/g, '",\n"');

  // Unescape single quotes (some models use \' instead of ')
  repaired = repaired.replace(/\\'/g, "'");

  // Fix unescaped newlines inside strings (not ideal but works)
  repaired = repaired.replace(/:\s*"([^"]*?)(\n)([^"]*?)"/g, (_m, a, _nl, b) => {
    return `: "${a}\\n${b}"`;
  });

  return repaired;
}

/**
 * Parse JSON from LLM output with multiple fallback strategies.
 * Returns the parsed object or throws if all strategies fail.
 */
export function parseJSON<T = any>(raw: string): T {
  // Step 1: Strip thinking blocks
  let cleaned = stripThinkingBlocks(raw);

  // Step 2: Extract JSON from markdown or raw text
  cleaned = extractJSON(cleaned);

  // Step 3: Try direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue to repair
  }

  // Step 4: Repair and retry
  const repaired = repairJSON(cleaned);
  try {
    return JSON.parse(repaired) as T;
  } catch {
    // Continue to more aggressive repair
  }

  // Step 5: Try finding the largest valid JSON substring
  for (let end = repaired.length; end > 0; end--) {
    try {
      return JSON.parse(repaired.slice(0, end)) as T;
    } catch {
      // Keep trying
    }
  }

  throw new Error(`Failed to parse JSON from LLM output. First 200 chars: ${raw.slice(0, 200)}`);
}
