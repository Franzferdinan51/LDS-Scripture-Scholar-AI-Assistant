import { GoogleGenAI, Chat, Session, LiveServerMessage, Modality, Type, GenerateContentResponse, Content, FunctionCall, FunctionResponse } from "@google/genai";
import { ApiProviderSettings, ChatMode, Model, Message, ThinkingDepth, THINKING_BUDGETS, UserProfile, Memory, Skill, ToolCall } from "../types";
import { buildSystemPrompt } from "./promptBuilder";
import { SCRIPTURE_TOOLS, getGeminiToolDeclarations } from "./tools";
import { executeTool } from "./toolExecutor";

// --- Enhanced Error Types ---
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true,
    public fallback?: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}


const JOURNAL_SUMMARY_SYSTEM_INSTRUCTION = `You are an insightful and gentle gospel assistant. A user has just finished a voice journal entry. Your task is to analyze their transcribed thoughts and provide helpful insights. You must respond with ONLY a valid JSON object. Do not add any other text. The JSON response must follow this schema:
{
  "summary": "A concise, one-paragraph summary of the user's main thoughts.",
  "principles": ["A list of 2-3 key gospel principles or themes identified in the entry."],
  "suggestedScripture": "A single, relevant scripture reference (e.g., 'Alma 32:21') that relates to their journal entry, for their further study."
}`;

const CROSS_REFERENCE_SYSTEM_INSTRUCTION = `You are an expert scripture cross-referencing tool for members of The Church of Jesus Christ of Latter-day Saints. Your task is to find and explain related scriptures for a given verse. When analyzing, consider:
1. Doctrinal parallels - scriptures that teach the same principle
2. Historical context - related events or time periods
3. Thematic connections - shared themes like faith, atonement, covenant, etc.
4. Prophetic commentary - where prophets reference or expand on the same ideas
5. Cross-standard work connections - links between Book of Mormon, Bible, D&C, and Pearl of Great Price

You must respond with ONLY a valid JSON object. Do not add any other text. The JSON response must follow this schema:
{
  "mainScripture": "The user's provided scripture reference",
  "context": "Brief historical or doctrinal context for the main scripture",
  "references": [
    { "scripture": "Reference string", "explanation": "A brief explanation of how this scripture relates to the main one.", "connectionType": "doctrinal|historical|thematic|prophetic" },
    { "scripture": "Reference string", "explanation": "Another brief explanation.", "connectionType": "doctrinal|historical|thematic|prophetic" },
    { "scripture": "Reference string", "explanation": "A third brief explanation.", "connectionType": "doctrinal|historical|thematic|prophetic" }
  ],
  "studySuggestions": ["One or two suggestions for deeper study of this topic"]
}`;

const toGeminiHistory = (history: Message[]): Content[] => {
    const relevantMessages = history.filter(m => !m.isSuggestion && m.id !== 'initial-message');
    return relevantMessages.map(msg => {
        const parts: any[] = [{ text: msg.text }];
        // If message has tool calls with results, include them
        if (msg.toolCalls && msg.toolCalls.length > 0) {
            for (const tc of msg.toolCalls) {
                if (tc.status === 'completed' && tc.result) {
                    parts.push({
                        functionResponse: {
                            name: tc.name,
                            response: tc.result,
                        }
                    });
                }
            }
        }
        return {
            role: msg.sender === 'user' ? 'user' : 'model',
            parts,
        };
    }).filter(c => c.parts[0].text);
};

// --- Enhanced Chat Service with Function Calling ---

export interface ChatServiceOptions {
  profile?: UserProfile | null;
  memories?: Memory[];
  activeSkill?: Skill | null;
  readingContext?: string;
  thinkingDepth?: ThinkingDepth;
}

export const createChatService = (
    settings: ApiProviderSettings,
    chatMode: ChatMode,
    history: Message[],
    options: ChatServiceOptions = {}
) => {
    if (settings.provider === 'google') {
        if (!settings.googleApiKey) throw new Error("Google API Key is not set.");
        const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });

        const modelName = ['study-plan', 'multi-quiz', 'lesson-prep', 'fhe-planner'].includes(chatMode)
            ? 'gemini-2.5-pro'
            : settings.model || 'gemini-flash-lite-latest';

        const systemInstruction = buildSystemPrompt(
            chatMode,
            options.profile,
            options.memories,
            options.activeSkill,
            options.readingContext
        );

        // Build tools config
        const tools: any[] = [{ googleSearch: {} }];
        // Add function declarations for chat mode
        if (chatMode === 'chat' || chatMode === 'thinking') {
            const functionDeclarations = getGeminiToolDeclarations();
            if (functionDeclarations.length > 0) {
                tools.push({ functionDeclarations });
            }
        }

        // Build config
        const config: any = {
            systemInstruction,
            tools,
        };

        // Add thinking budget for thinking mode
        if (chatMode === 'thinking' && options.thinkingDepth) {
            config.thinkingConfig = {
                thinkingBudget: THINKING_BUDGETS[options.thinkingDepth],
            };
        }

        const chat = ai.chats.create({
            model: modelName,
            history: toGeminiHistory(history),
            config,
        });

        // Track tool calls for this conversation turn
        const toolCalls: ToolCall[] = [];

        return {
            sendMessageStream: async ({ message }: { message: string }) => {
                return chat.sendMessageStream({ message });
            },
            handleToolCalls: async (response: GenerateContentResponse): Promise<GenerateContentResponse | null> => {
                // Check if response contains function calls
                const functionCalls = response.functionCalls;
                if (!functionCalls || functionCalls.length === 0) return null;

                // Execute each tool call
                const functionResponses: FunctionResponse[] = [];

                for (const fc of functionCalls) {
                    const tcId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const toolCall: ToolCall = {
                        id: tcId,
                        name: fc.name,
                        parameters: fc.args || {},
                        status: 'running',
                    };
                    toolCalls.push(toolCall);

                    try {
                        const result = await executeTool(fc.name, fc.args || {}, settings.googleApiKey);
                        toolCall.status = 'completed';
                        toolCall.result = result;

                        functionResponses.push({
                            name: fc.name,
                            response: result as unknown as Record<string, unknown>,
                        });
                    } catch (e) {
                        toolCall.status = 'error';
                        toolCall.result = { success: false, data: null, error: String(e) };

                        functionResponses.push({
                            name: fc.name,
                            response: { error: String(e) },
                        });
                    }
                }

                // Send function responses back to model
                const followUp = await chat.sendMessageStream({
                    message: functionResponses.map(fr => ({
                        functionResponse: fr,
                    }) as any),
                } as any);

                return followUp as any;
            },
            getToolCalls: () => [...toolCalls],
        };
    } else {
        // Non-Google providers (OpenAI-compatible)
        let baseUrl = '';
        let apiKey = '';
        switch(settings.provider) {
            case 'lmstudio':
                baseUrl = settings.lmStudioBaseUrl;
                apiKey = settings.lmStudioApiKey || '';
                break;
            case 'openrouter':
                baseUrl = settings.openRouterBaseUrl;
                apiKey = settings.openRouterApiKey;
                break;
            case 'mcp': baseUrl = settings.mcpBaseUrl; break;
            case 'minimax':
                baseUrl = settings.minimaxBaseUrl || 'https://api.minimax.chat/v1';
                apiKey = settings.minimaxApiKey || '';
                break;
        }

        const sendMessageStream = async function* ({ message }: { message: string }): AsyncGenerator<GenerateContentResponse> {
            const systemInstruction = buildSystemPrompt(
                chatMode,
                options.profile,
                options.memories,
                options.activeSkill,
                options.readingContext
            );

            const messages = [
                { role: 'system', content: systemInstruction },
                ...history.filter(m => m.id !== 'initial-message' && m.text).map(m => ({
                    role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
                    content: m.text
                })),
                { role: 'user' as const, content: message }
            ];

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.body) throw new Error("Response body is null");

            const reader = response.body.getReader();
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
                        if (jsonStr.trim() === '[DONE]') {
                            return;
                        }
                        try {
                            const chunk = JSON.parse(jsonStr);
                            const text = chunk.choices[0]?.delta?.content || '';
                            if (text) {
                                yield { text } as any;
                            }
                        } catch (e) {
                            console.error('Error parsing stream chunk:', e, jsonStr);
                        }
                    }
                }
            }
        };

        return {
            sendMessageStream,
            handleToolCalls: async () => null, // No tool calling for non-Google
            getToolCalls: () => [],
        };
    }
};

// --- Multi-Provider Failover ---

export const createChatServiceWithFailover = (
    settings: ApiProviderSettings,
    chatMode: ChatMode,
    history: Message[],
    options: ChatServiceOptions = {}
) => {
    try {
        return createChatService(settings, chatMode, history, options);
    } catch (e) {
        // Try fallback provider
        if (settings.fallbackProvider && settings.fallbackModel) {
            console.warn('Primary provider failed, trying fallback:', e);
            const fallbackSettings: ApiProviderSettings = {
                ...settings,
                provider: settings.fallbackProvider,
                model: settings.fallbackModel,
            };
            return createChatService(fallbackSettings, chatMode, history, options);
        }
        throw e;
    }
};

// --- Existing Exports (unchanged) ---

export const connectLive = (apiKey: string, callbacks: any, systemInstruction?: string): Promise<Session> => {
    if (!apiKey) throw new Error("Google API Key is not set for Live Connect.");
    const ai = new GoogleGenAI({ apiKey });

    if (systemInstruction && systemInstruction.includes('transcription assistant')) {
         return ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks,
            config: {
                inputAudioTranscription: {},
                systemInstruction: systemInstruction,
            },
        });
    }

    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
    });
};

export const generateSpeech = async (apiKey: string, text: string): Promise<string> => {
    if (!apiKey) throw new Error("Google API Key is not set for TTS.");
    const ai = new GoogleGenAI({ apiKey });
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
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from API.");
    }
    return base64Audio;
};

export const getJournalInsights = async (apiKey: string, text: string): Promise<any> => {
    if (!apiKey) throw new Error("Google API Key is not set for Journal Insights.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: text,
        config: {
            systemInstruction: JOURNAL_SUMMARY_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json'
        },
    });
    const jsonText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonText);
};

export const getProactiveSuggestion = async (apiKey: string, history: Content[]): Promise<string | null> => {
    if (!apiKey || history.length === 0) return null;
    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: history,
            config: {
                systemInstruction: `You are a helpful assistant. Based on this short conversation history, suggest ONE concise and relevant follow-up question the user might be interested in asking. The suggestion should be a question. Do not add any preamble. Respond with only the question text.`,
                stopSequences: ['\n'],
                temperature: 0.8,
            },
        });
        let suggestion = response.text.trim();
        if (suggestion.startsWith('"') && suggestion.endsWith('"')) {
            suggestion = suggestion.substring(1, suggestion.length - 1);
        }
        return suggestion;
    } catch (e) {
        console.error("Failed to get proactive suggestion:", e);
        return null;
    }
};

export const getWikimediaImageUrl = async (filename: string): Promise<string> => {
    const WIKIMEDIA_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
    const params = new URLSearchParams({
        action: "query",
        prop: "imageinfo",
        titles: filename,
        iiprop: "url",
        format: "json",
        origin: "*"
    });
    const response = await fetch(`${WIKIMEDIA_API_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error(`Wikimedia API error: ${response.statusText}`);
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId === "-1" || !pages[pageId].imageinfo) {
        throw new Error("Image not found on Wikimedia Commons.");
    }
    return pages[pageId].imageinfo[0].url;
};

// Pre-populated model lists for providers that don't have a standard /models endpoint
const MINIMAX_MODELS: Model[] = [
    { id: 'MiniMax-Text-01', name: 'MiniMax Text 01' },
    { id: 'abab6.5s-chat', name: 'Abab 6.5s Chat' },
    { id: 'abab6.5g-chat', name: 'Abab 6.5g Chat' },
    { id: 'abab6.5t-chat', name: 'Abab 6.5t Chat' },
    { id: 'abab6-chat', name: 'Abab 6 Chat' },
    { id: 'abab5.5s-chat', name: 'Abab 5.5s Chat' },
    { id: 'abab5.5-chat', name: 'Abab 5.5 Chat' },
];

export const fetchModels = async (settings: ApiProviderSettings): Promise<Model[]> => {
    // MiniMax uses pre-populated models (no standard /models endpoint)
    if (settings.provider === 'minimax') {
        return MINIMAX_MODELS;
    }

    let url: string;
    let headers: Record<string, string> = {};

    switch (settings.provider) {
        case 'lmstudio':
            url = `${settings.lmStudioBaseUrl}/models`;
            if (settings.lmStudioApiKey) {
                headers['Authorization'] = `Bearer ${settings.lmStudioApiKey}`;
            }
            break;
        case 'mcp':
            url = `${settings.mcpBaseUrl}/models`;
            break;
        case 'openrouter':
            url = `${settings.openRouterBaseUrl}/models`;
            headers['Authorization'] = `Bearer ${settings.openRouterApiKey}`;
            break;
        default:
            return [];
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch models: ${response.status} ${errorText}`);
        }
        const data = await response.json();

        if (settings.provider === 'openrouter') {
            return data.data.map((model: any) => ({
                id: model.id,
                name: model.name || model.id,
                isFree: model.pricing?.prompt === "0" && model.pricing?.completion === "0"
            })).sort((a: Model, b: Model) => (a.name || '').localeCompare(b.name || ''));
        } else {
            return data.data.map((model: any) => ({
                id: model.id,
                name: model.id,
                isFree: true
            })).sort((a: Model, b: Model) => (a.name || '').localeCompare(b.name || ''));
        }
    } catch (e: any) {
        if (e.message?.includes('Failed to fetch') || e.name === 'TypeError') {
            throw new Error(`Cannot reach ${url}. Make sure the server is running and CORS is configured.`);
        }
        throw e;
    }
};

export const testMCPConnection = async (baseUrl: string): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch(`${baseUrl}/models`);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error body.');
            return { success: false, message: `Connection failed with status ${response.status}: ${errorText}` };
        }
        const data = await response.json();
        const modelCount = data.data?.length || 0;
        return { success: true, message: `Connection successful! Found ${modelCount} models.` };
    } catch (e) {
        if (e instanceof TypeError && e.message === 'Failed to fetch') {
            return { success: false, message: `Could not reach the server at ${baseUrl}. Is it running and is CORS configured correctly?` };
        }
        if (e instanceof Error) {
            return { success: false, message: `Connection failed: ${e.message}` };
        }
        return { success: false, message: "An unknown error occurred during connection test." };
    }
};

export const getCrossReferences = async (apiKey: string, scripture: string): Promise<any> => {
    if (!apiKey) throw new Error("Google API Key is not set for Cross-References.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: scripture,
        config: {
            systemInstruction: CROSS_REFERENCE_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json'
        },
    });
    const jsonText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonText);
};
