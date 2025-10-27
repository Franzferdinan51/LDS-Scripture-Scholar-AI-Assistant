import { GoogleGenAI, Chat, Session, LiveServerMessage, Modality, Type, GenerateContentResponse, Content } from "@google/genai";
import { ApiProviderSettings, ChatMode, Model, Message } from "../types";

const SYSTEM_INSTRUCTION = `You are an advanced agentic chatbot named "Scripture Scholar", created by Ryan Smith. You are an open-source project, and your code can be found at https://github.com/Franzferdinan51/LDS-Scripture-Scholar-AI-Assistant/tree/main. Your role is to act as an expert research assistant on the Book of Mormon and The Church of Jesus Christ of Latter-day Saints (LDS Church).

**Thinking Process:** Before providing your final answer, you MUST use <thinking>...</thinking> XML tags to outline your thought process, plan, and any self-correction. This is a scratchpad for your reasoning and will be hidden from the user.

**Core Directives:**
1.  **Source Authority:** You must base your answers strictly on the scriptures (Book of Mormon, Bible, Doctrine and Covenants, Pearl of Great Price) and official publications from the LDS Church. Use your search tools to verify information and find content from official sources like ChurchofJesusChrist.org.
2.  **Agentic Image Search:** When a user asks for an image, you MUST follow these rules:
    -   **Scope Check:** First, determine if the request is DIRECTLY related to the history, people, places, or artifacts of The Church of Jesus Christ of Latter-day Saints.
    -   **Strict Prohibition:** If the request is NOT directly related (e.g., "a cat", "the Eiffel Tower", "Temple of Dendur", "a sexy woman"), you MUST refuse the request with this exact phrase and nothing else: "I can only search for images related to The Church of Jesus Christ of Latter-day Saints."
    -   **Execution:** If the request IS within scope, you MUST use the following process:
        -   **Step 1: Search.** Use the \`googleSearch\` tool to find a relevant page on Wikimedia Commons (\`commons.wikimedia.org\`).
        -   **Step 2: Extract.** From the search result, you MUST extract the exact filename. The filename always starts with "File:". For example, from the URL \`https://commons.wikimedia.org/wiki/File:Salt_Lake_Temple.jpg\`, you would extract \`File:Salt_Lake_Temple.jpg\`.
        -   **Step 3: Output.** Your entire response MUST contain ONLY the special tag with the filename you extracted, in this exact format: \`WIKIMEDIA_SEARCH[FILENAME_HERE]\`. Example: \`WIKIMEDIA_SEARCH[File:Salt_Lake_Temple.jpg]\`.
        -   **Fallback:** If you search and cannot find a suitable Wikimedia Commons file, you must state that you were unable to find a relevant image.
3.  **Scope Limitation:** If a question is outside your scope, politely decline and guide the user back. For example: "That's an interesting question, but my expertise is focused on the Book of Mormon and the teachings of The Church of Jesus Christ of Latter-day Saints. Do you have a question about those topics?"
4.  **Tone:** Maintain a respectful, helpful, and neutral tone. Do not engage in debates, express personal opinions, or speculate on doctrine.`;

const STUDY_PLAN_SYSTEM_INSTRUCTION = `You are a helpful study assistant for members of The Church of Jesus Christ of Latter-day Saints.
Your task is to generate a structured, multi-day study plan on a given gospel topic.
When a user provides a topic, you MUST create a response with ONLY a valid JSON object that adheres to the following schema. Do not include any other text, explanation, or markdown formatting like \`\`\`json.

The JSON object must have these exact keys:
- "title": A string for the overall study plan, e.g., "A 3-Day Study of Faith".
- "days": An array of objects, where each object represents one day of study. Each day object must have these keys:
  - "day": An integer representing the day number (e.g., 1).
  - "topic": A string for that day's specific focus.
  - "scriptures": An array of 3-4 strings, each being a key scripture reference for that day.
  - "reflection_question": A string containing a single, thought-provoking question for reflection.
`;

const MULTI_QUIZ_SYSTEM_INSTRUCTION = `You are a quiz master specializing in the scriptures and history of The Church of Jesus Christ of Latter-day Saints.
Your task is to generate a multi-question quiz based on the topic provided by the user. The quiz should contain exactly 5 multiple-choice questions.
You MUST respond with ONLY a valid JSON object that adheres to the following schema. Do not include any other text, explanation, or markdown formatting like \`\`\`json.

The JSON object must have these exact keys:
- "title": A string for the quiz title, e.g., "Quiz: The Life of Nephi".
- "questions": An array of 5 question objects. Each question object must have these keys:
    - "question": A string containing the question.
    - "options": An array of 4 strings, representing the multiple-choice answers.
    - "correctAnswerIndex": An integer (from 0 to 3) indicating the index of the correct answer in the "options" array.
`;

const CROSS_REFERENCE_SYSTEM_INSTRUCTION = `You are an expert scripture cross-referencing tool for members of The Church of Jesus Christ of Latter-day Saints. Your task is to find and explain related scriptures for a given verse. You must respond with ONLY a valid JSON object. Do not add any other text. The JSON response must follow this schema:
{
  "mainScripture": "The user's provided scripture reference",
  "references": [
    { "scripture": "Reference string", "explanation": "A brief explanation of how this scripture relates to the main one." },
    { "scripture": "Reference string", "explanation": "Another brief explanation." },
    { "scripture": "Reference string", "explanation": "A third brief explanation." }
  ]
}`;

const JOURNAL_SUMMARY_SYSTEM_INSTRUCTION = `You are an insightful and gentle gospel assistant. A user has just finished a voice journal entry. Your task is to analyze their transcribed thoughts and provide helpful insights. You must respond with ONLY a valid JSON object. Do not add any other text. The JSON response must follow this schema:
{
  "summary": "A concise, one-paragraph summary of the user's main thoughts.",
  "principles": ["A list of 2-3 key gospel principles or themes identified in the entry."],
  "suggestedScripture": "A single, relevant scripture reference (e.g., 'Alma 32:21') that relates to their journal entry, for their further study."
}`;

const LESSON_PREP_SYSTEM_INSTRUCTION = `You are an expert "Lesson Preparation Agent" for members of The Church of Jesus Christ of Latter-day Saints. Your goal is to help users create comprehensive and engaging lessons or talks.

**Agentic Process:**
1.  **Deconstruct Request:** Analyze the user's prompt to identify the core \`topic\`, target \`audience\`, \`time limit\`, and any specified \`source materials\` (e.g., "latest General Conference").
2.  **Plan & Research:** Formulate a plan to gather materials.
    -   Use your search tool to find relevant talks, scriptures, and stories from official Church websites (ChurchofJesusChrist.org). Prioritize recent General Conference talks if requested or relevant.
    -   Identify a central theme, a key scripture, a compelling story or quote, and supporting principles.
3.  **Synthesize & Structure:** Assemble the gathered materials into a clear, structured lesson outline. The final output should be well-formatted using Markdown and include:
    -   **Title:** A clear title for the lesson.
    -   **Objective:** A one-sentence goal for the lesson.
    -   **Opening:** A suggestion for an opening song or prayer.
    -   **Discussion & Study:** The main body of the lesson, including key scriptures, quotes from leaders, and discussion questions tailored to the audience.
    -   **Activity/Application:** A simple activity or challenge to help learners apply the principle.
    -   **Closing:** A suggestion for a closing song, prayer, or final testimony.

You MUST use your search tool to find current and relevant source material.`;

const FHE_PLANNER_SYSTEM_INSTRUCTION = `You are a creative "Family Home Evening Planner" assistant. Your task is to generate a complete, age-appropriate FHE plan based on a user's topic request.

**Agentic Process:**
1.  **Deconstruct Request:** Identify the gospel \`topic\` and the \`ages of children\` in the family to tailor the plan.
2.  **Plan Content:** Create a plan with the following components:
    -   **Song:** Suggest a relevant song from the Children's Songbook or Hymnbook.
    -   **Scripture:** Choose a short, simple scripture or story that teaches the topic.
    -   **Lesson:** Write a brief, easy-to-understand lesson using simple language and a story or analogy.
    -   **Activity:** Design a fun, interactive activity or object lesson that reinforces the principle.
    -   **Treat:** Suggest a simple, fun treat idea that might tie into the theme.
3.  **Synthesize & Present:** Format the response in clear, easy-to-follow Markdown sections (Song, Scripture, Lesson, Activity, Treat).`;

const PROACTIVE_SUGGESTION_SYSTEM_INSTRUCTION = `You are a helpful study companion AI. Your task is to review the last few messages of a conversation and identify an opportunity to deepen the user's study.
- Analyze the conversation to find the main topic.
- Think of a logical next step, like comparing the current topic to another scripture, exploring a related principle, or asking a thought-provoking question.
- If you can formulate a valuable suggestion, respond ONLY with that suggestion as a single, engaging question (under 25 words).
- If you have no valuable suggestion, you MUST respond with the exact text: 'NO_SUGGESTION'.`;


// --- Google Gemini Specific ---
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
const getGoogleAi = (apiKey: string) => {
    if (!ai || currentApiKey !== apiKey) {
        ai = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
    }
    return ai;
};

const createMockResponse = (text: string): GenerateContentResponse => ({
    text: text,
    candidates: [],
    functionCalls: [],
} as any);


// --- OpenAI Compatible (LM Studio / OpenRouter / MCP) ---
class OpenAIChatWrapper {
    private settings: ApiProviderSettings;
    private systemInstruction: string;
    private history: Message[];

    constructor(settings: ApiProviderSettings, systemInstruction: string, history: Message[]) {
        this.settings = settings;
        this.systemInstruction = systemInstruction;
        this.history = history.filter(m => !m.isSuggestion);
    }

    async *sendMessageStream(message: string): AsyncGenerator<GenerateContentResponse> {
        const { provider, openRouterApiKey, lmStudioBaseUrl, openRouterBaseUrl, model, mcpBaseUrl } = this.settings;
        
        let baseURL: string;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };

        switch(provider) {
            case 'lmstudio':
                baseURL = lmStudioBaseUrl;
                break;
            case 'openrouter':
                baseURL = openRouterBaseUrl;
                headers['Authorization'] = `Bearer ${openRouterApiKey}`;
                break;
            case 'mcp':
                baseURL = mcpBaseUrl;
                break;
            default:
                throw new Error(`Unsupported provider in OpenAIChatWrapper: ${provider}`);
        }
        
        const messages = [
            { role: 'system', content: this.systemInstruction },
            ...this.history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            })),
            { role: 'user', content: message }
        ];

        try {
            const response = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Request failed with status ${response.status}: ${errorBody}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("Failed to get response reader");
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6);
                        if (jsonStr === '[DONE]') {
                            return;
                        }
                        try {
                            const chunk = JSON.parse(jsonStr);
                            const text = chunk.choices[0]?.delta?.content || '';
                            if (text) {
                                yield createMockResponse(text);
                            }
                        } catch (e) {
                            console.error('Error parsing stream chunk:', e, 'line:', line);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`${provider} API Error:`, error);
            if (error instanceof Error) {
                throw new Error(`Network or API error: ${error.message}`);
            }
            throw new Error("An unknown error occurred.");
        }
    }
}


// --- Main Service Creation and Functions ---

const getSystemInstruction = (mode: ChatMode, provider: ApiProviderSettings['provider']) => {
    switch(mode) {
        case 'study-plan': return STUDY_PLAN_SYSTEM_INSTRUCTION;
        case 'multi-quiz': return MULTI_QUIZ_SYSTEM_INSTRUCTION;
        case 'lesson-prep': return LESSON_PREP_SYSTEM_INSTRUCTION;
        case 'fhe-planner': return FHE_PLANNER_SYSTEM_INSTRUCTION;
        case 'thinking': 
        case 'chat':
        default:
           return SYSTEM_INSTRUCTION;
    }
}

export const createChatService = (settings: ApiProviderSettings, chatMode: ChatMode, history: Message[]) => {
    const systemInstruction = getSystemInstruction(chatMode, settings.provider);

    const geminiSystemInstruction: Content = { role: 'system', parts: [{ text: systemInstruction }] };
    let geminiHistory: Content[] = history.filter(m => !m.isSuggestion).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    // Ensure history starts with a user message for Gemini
    if (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
        geminiHistory = geminiHistory.slice(1);
    }

    switch (settings.provider) {
        case 'google':
            if (!settings.googleApiKey) throw new Error("Google API Key is not set.");
            const ai = getGoogleAi(settings.googleApiKey);
            const modelName = (chatMode === 'thinking' || chatMode === 'lesson-prep' || chatMode === 'fhe-planner') ? 'gemini-2.5-pro' : settings.model;
            
            return ai.chats.create({
                model: modelName,
                config: { systemInstruction: geminiSystemInstruction },
                history: geminiHistory,
            });
        case 'lmstudio':
        case 'openrouter':
        case 'mcp':
            return new OpenAIChatWrapper(settings, systemInstruction, history);
        default:
            throw new Error(`Unsupported API provider: ${settings.provider}`);
    }
};

export const fetchModels = async (settings: ApiProviderSettings): Promise<Model[]> => {
    const { provider, lmStudioBaseUrl, openRouterBaseUrl, openRouterApiKey, mcpBaseUrl } = settings;
    
    let url: string;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    switch (provider) {
        case 'lmstudio':
            url = `${lmStudioBaseUrl}/models`;
            break;
        case 'openrouter':
            url = `${openRouterBaseUrl}/models`;
            headers['Authorization'] = `Bearer ${openRouterApiKey}`;
            break;
        case 'mcp':
            url = `${mcpBaseUrl}/models`;
            break;
        default:
            return []; // Not a provider that supports fetching models
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const models = (data.data || data).map((model: any) => ({
            id: model.id,
            name: model.name || model.id,
            isFree: model.pricing?.prompt === "0"
        }));
        
        models.sort((a: Model, b: Model) => (a.name || a.id).localeCompare(b.name || b.id));

        return models;
    } catch (err) {
        console.error("Fetch models error:", err);
        throw err;
    }
};


export const getCrossReferences = async (apiKey: string, scripture: string) => {
    const ai = getGoogleAi(apiKey);
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: scripture,
        config: {
          systemInstruction: CROSS_REFERENCE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  mainScripture: { type: Type.STRING },
                  references: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              scripture: { type: Type.STRING },
                              explanation: { type: Type.STRING }
                          }
                      }
                  }
              }
          }
        },
    });
    return JSON.parse(response.text.trim());
};

export const getJournalInsights = async (apiKey: string, text: string) => {
    const ai = getGoogleAi(apiKey);
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `Here is the user's journal entry: "${text}"`,
        config: {
          systemInstruction: JOURNAL_SUMMARY_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  summary: { type: Type.STRING },
                  principles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  suggestedScripture: { type: Type.STRING }
              }
          }
        },
    });
    return JSON.parse(response.text.trim());
};


export const connectLive = async (apiKey: string, callbacks: any, systemInstruction = SYSTEM_INSTRUCTION): Promise<Session> => {
    const ai = getGoogleAi(apiKey);
    const sessionPromise = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction
        },
    });
    return sessionPromise;
}

export const generateSpeech = async (apiKey: string, text: string): Promise<string> => {
    const ai = getGoogleAi(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
}

export const getProactiveSuggestion = async (apiKey: string, history: Content[]) => {
    const ai = getGoogleAi(apiKey);
    try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: { role: 'user', parts: [{ text: "Based on our conversation, suggest a next step." }]},
          config: {
            systemInstruction: PROACTIVE_SUGGESTION_SYSTEM_INSTRUCTION,
            // Low temp to be more deterministic about suggestions
            temperature: 0.3,
          },
          history: history,
        });
        const text = response.text.trim();
        if (text === 'NO_SUGGESTION') return null;
        return text;
    } catch (e) {
        console.warn("Proactive suggestion failed:", e);
        return null; // Fail silently
    }
}

export const getWikimediaImageUrl = async (filename: string): Promise<string> => {
    const url = `https://api.wikimedia.org/core/v1/commons/file/${encodeURIComponent(filename)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Wikimedia API error: ${response.statusText}`);
    const data = await response.json();
    // Prefer a scaled-down version if available, otherwise use original
    return data.preferred?.url || data.original.url;
};

export const testMCPConnection = async (baseUrl: string): Promise<{ success: boolean; message: string }> => {
    // Docker MCP's gateway is OpenAI compatible, so it should have a /models endpoint.
    const url = `${baseUrl}/models`;
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Could not read error body.');
            return {
                success: false,
                message: `Connection failed. Server responded with status ${response.status} ${response.statusText}.\n\nDetails:\n${errorBody}`
            };
        }
        
        const data = await response.json();
        const modelCount = data?.data?.length || data?.length || 0;
        
        return {
            success: true,
            message: `Connection successful! Found ${modelCount} model(s).`
        };

    } catch (error) {
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof TypeError) {
            // This often indicates a network error (CORS, failed to fetch, etc.)
            errorMessage = `Network error. Could not connect to the URL.\n\n- Check if the URL is correct (e.g., http://localhost:8080/v1).\n- Ensure your MCP server is running.\n- Check for CORS issues if running from a different domain.`;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return {
            success: false,
            message: `Connection failed.\n\nDetails:\n${errorMessage}`
        };
    }
};