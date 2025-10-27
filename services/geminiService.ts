// Fix: Replaced 'LiveSession' with 'Session' as it is not an exported member.
import { GoogleGenAI, Chat, Session, LiveServerMessage, Modality, Type, GenerateContentResponse, Content } from "@google/genai";
import { ApiProviderSettings, ChatMode, Model, Message } from "../types";

const SYSTEM_INSTRUCTION = `You are an advanced agentic chatbot named "Scripture Scholar". Your role is to act as an expert research assistant on the Book of Mormon and The Church of Jesus Christ of Latter-day Saints (LDS Church).

**Core Directives:**
1.  **Source Authority:** You must base your answers strictly on the scriptures (Book of Mormon, Bible, Doctrine and Covenants, Pearl of Great Price) and official publications from the LDS Church. Use your search tools to verify information and find content from official sources like ChurchofJesusChrist.org.
2.  **Agentic Image Search:** When a user asks for an image related to The Church of Jesus Christ of Latter-day Saints (e.g., temples, historical sites, prophets), you MUST use the following process. If the request is not related to the Church, politely decline.
    -   **Step 1: Search.** Use the \`googleSearch\` tool to find a relevant page on Wikimedia Commons (\`commons.wikimedia.org\`).
    -   **Step 2: Extract.** From the search result's URL or title, you MUST extract the filename. The filename always starts with "File:". For example, from the URL \`https://commons.wikimedia.org/wiki/File:Salt_Lake_Temple.jpg\`, you would extract \`File:Salt_Lake_Temple.jpg\`.
    -   **Step 3: Output.** Your entire response MUST contain ONLY the special tag with the filename you extracted, in this exact format: \`WIKIMEDIA_SEARCH[FILENAME_HERE]\`. For example: \`WIKIMEDIA_SEARCH[File:Salt_Lake_Temple.jpg]\`. The system will automatically convert this tag into an image.
    -   **Fallback:** If you use the search tool and cannot find a suitable Wikimedia Commons file, you must state that you were unable to find an image.
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
// Fix: The 'apiKey' property is private. Store the key in a local variable to check for changes.
let currentApiKey: string | null = null;
const getGoogleAi = (apiKey: string) => {
    if (!ai || currentApiKey !== apiKey) {
        ai = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
    }
    return ai;
};

// This is a mock response object to make the OpenAI stream compatible with the Google stream.
// Fix: The mock object did not match the 'GenerateContentResponse' type. Using 'as any' to cast it, as it's a mock for a different API stream.
const createMockResponse = (text: string): GenerateContentResponse => ({
    text: text,
    candidates: [],
    functionCalls: [],
    // Add any other properties your app might access to avoid null pointer errors
} as any);


// --- OpenAI-Compatible API (LM Studio, OpenRouter) ---

async function* streamOpenAIResponse(settings: ApiProviderSettings, messages: { role: string; content: string }[]): AsyncGenerator<GenerateContentResponse> {
    const isLmStudio = settings.provider === 'lmstudio';
    const baseUrl = isLmStudio ? settings.lmStudioBaseUrl : settings.openRouterBaseUrl;
    const apiKey = isLmStudio ? 'lm-studio' : settings.openRouterApiKey;
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [
                { role: "system", content: SYSTEM_INSTRUCTION },
                ...messages
            ],
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API Error:", errorText);
        throw new Error(`Failed to fetch from ${settings.provider}: ${response.status} ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last partial line in the buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                if (jsonStr === '[DONE]') {
                    return;
                }
                try {
                    const chunk = JSON.parse(jsonStr);
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                        yield createMockResponse(content);
                    }
                } catch (e) {
                    console.error('Error parsing stream chunk:', e);
                }
            }
        }
    }
}


// --- Generic Chat Interface ---
interface GenericChat {
    sendMessageStream(text: string): Promise<AsyncGenerator<GenerateContentResponse>>;
}

class GoogleChatWrapper implements GenericChat {
    private chat: Chat;
    constructor(apiKey: string, model: string, mode: ChatMode, history: Content[]) {
        const genAI = getGoogleAi(apiKey);
        
        const isThinkingMode = mode === 'thinking';
        const isStudyPlanMode = mode === 'study-plan';
        const isMultiQuizMode = mode === 'multi-quiz';
        const isLessonPrepMode = mode === 'lesson-prep';
        const isFhePlannerMode = mode === 'fhe-planner';
        
        const systemInstruction = 
            isStudyPlanMode ? STUDY_PLAN_SYSTEM_INSTRUCTION :
            isMultiQuizMode ? MULTI_QUIZ_SYSTEM_INSTRUCTION :
            isLessonPrepMode ? LESSON_PREP_SYSTEM_INSTRUCTION :
            isFhePlannerMode ? FHE_PLANNER_SYSTEM_INSTRUCTION :
            SYSTEM_INSTRUCTION;

        const modelName = (isThinkingMode || isStudyPlanMode || isMultiQuizMode || isLessonPrepMode || isFhePlannerMode) ? 'gemini-2.5-pro' : model;
        
        const isJsonMode = isStudyPlanMode || isMultiQuizMode;
        const tools = isJsonMode ? undefined : [{googleSearch: {}}, {googleMaps: {}}];

        this.chat = genAI.chats.create({
            model: modelName,
            history: history,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.5,
                tools: tools,
                ...(isThinkingMode && { thinkingConfig: { thinkingBudget: 32768 } }),
                ...(isStudyPlanMode && { 
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            days: { 
                                type: Type.ARRAY,
                                items: { 
                                    type: Type.OBJECT,
                                    properties: {
                                        day: { type: Type.INTEGER },
                                        topic: { type: Type.STRING },
                                        scriptures: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        reflection_question: { type: Type.STRING }
                                    },
                                    required: ["day", "topic", "scriptures", "reflection_question"]
                                }
                            }
                        },
                        required: ["title", "days"]
                    }
                }),
                 ...(isMultiQuizMode && { 
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            questions: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        question: { type: Type.STRING },
                                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        correctAnswerIndex: { type: Type.INTEGER }
                                    },
                                    required: ["question", "options", "correctAnswerIndex"]
                                }
                            }
                        },
                        required: ["title", "questions"]
                    }
                }),
            },
        });
    }

    async sendMessageStream(text: string): Promise<AsyncGenerator<GenerateContentResponse>> {
        return this.chat.sendMessageStream({ message: text });
    }
}

class OpenAIChatWrapper implements GenericChat {
    private settings: ApiProviderSettings;
    private history: { role: 'user' | 'assistant', content: string }[] = [];

    constructor(settings: ApiProviderSettings, history: { role: 'user' | 'assistant', content: string }[]) {
        this.settings = settings;
        this.history = history;
    }

    async sendMessageStream(text: string): Promise<AsyncGenerator<GenerateContentResponse>> {
        this.history.push({ role: 'user', content: text });
        // The API provider maintains state, so we just send the new user message
        const messagesToSend = this.history;

        const stream = streamOpenAIResponse(this.settings, messagesToSend);
        
        // We need a reference to this.history that won't be stale inside the generator
        const historyRef = this.history;

        async function* generator(): AsyncGenerator<GenerateContentResponse> {
            let fullResponse = "";
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullResponse += chunkText;
                    yield chunk;
                }
            }
            historyRef.push({ role: 'assistant', content: fullResponse });
        }

        return generator();
    }
}


// --- Factory and Service Functions ---

export const createChatService = (
    settings: ApiProviderSettings, 
    mode: ChatMode, 
    history: Message[]
): GenericChat => {
    // Filter out suggestions and initial messages from history before sending to API
    const apiHistory = history
        .filter(m => !m.isSuggestion && m.id !== 'initial-message' && m.text);

    switch (settings.provider) {
        case 'google':
            if (!settings.googleApiKey) throw new Error("Google API Key is missing.");
            
            const googleHistory: Content[] = apiHistory.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));
            return new GoogleChatWrapper(settings.googleApiKey, settings.model, mode, googleHistory);
        
        case 'lmstudio':
        case 'openrouter':
            if (!settings.model) throw new Error(`Model for ${settings.provider} is not selected.`);
            
            const openAIHistory: { role: 'user' | 'assistant', content: string }[] = apiHistory.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));
            return new OpenAIChatWrapper(settings, openAIHistory);
        
        default:
            throw new Error("Invalid API provider selected.");
    }
};

export const generateSpeech = async (apiKey: string, text: string): Promise<string> => {
    const genAI = getGoogleAi(apiKey);
    const response = await genAI.models.generateContent({
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
}


export const connectLive = (
    apiKey: string,
    callbacks: {
        onopen: () => void;
        onmessage: (message: LiveServerMessage) => void;
        onerror: (e: ErrorEvent) => void;
        onclose: (e: CloseEvent) => void;
    },
    systemInstruction: string = SYSTEM_INSTRUCTION
// Fix: Replaced 'LiveSession' with 'Session' in the return type.
): Promise<Session> => {
    const genAI = getGoogleAi(apiKey);
    return genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: systemInstruction,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
        },
    });
};

export const fetchModels = async (settings: Pick<ApiProviderSettings, 'provider' | 'lmStudioBaseUrl' | 'openRouterBaseUrl' | 'openRouterApiKey'>): Promise<Model[]> => {
    const isLmStudio = settings.provider === 'lmstudio';
    const baseUrl = isLmStudio ? settings.lmStudioBaseUrl : settings.openRouterBaseUrl;
    const apiKey = isLmStudio ? 'lm-studio' : settings.openRouterApiKey;

    if (!baseUrl) {
        throw new Error("Base URL is not set.");
    }

    const response = await fetch(`${baseUrl}/models`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        isFree: model.pricing ? (parseFloat(model.pricing.prompt) === 0 && parseFloat(model.pricing.completion) === 0) : false
    }));
};

// --- New Standalone Service Functions ---

export const getCrossReferences = async (apiKey: string, scripture: string) => {
    const genAI = getGoogleAi(apiKey);
    const response = await genAI.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `Find cross-references for ${scripture}`,
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
                            },
                            required: ["scripture", "explanation"]
                        }
                    }
                },
                required: ["mainScripture", "references"]
            }
        }
    });
    return JSON.parse(response.text);
};


export const getJournalInsights = async (apiKey: string, journalText: string) => {
    const genAI = getGoogleAi(apiKey);
    const response = await genAI.models.generateContent({
        model: "gemini-2.5-pro",
        contents: journalText,
        config: {
            systemInstruction: JOURNAL_SUMMARY_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    principles: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggestedScripture: { type: Type.STRING }
                },
                required: ["summary", "principles", "suggestedScripture"]
            }
        }
    });
    return JSON.parse(response.text);
};

export const getProactiveSuggestion = async (apiKey: string, history: Content[]) => {
    const genAI = getGoogleAi(apiKey);
    try {
        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: history,
            config: {
                systemInstruction: PROACTIVE_SUGGESTION_SYSTEM_INSTRUCTION,
                temperature: 0.7,
            },
        });

        const suggestion = response.text.trim();
        if (suggestion && suggestion !== 'NO_SUGGESTION' && !suggestion.includes('NO_SUGGESTION')) {
            return suggestion;
        }
        return null;
    } catch (error) {
        console.error("Error fetching proactive suggestion:", error);
        return null; // Don't block the UI for this
    }
};

export const getWikimediaImageUrl = async (filename: string): Promise<string> => {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Wikimedia API request failed with status ${response.status}`);
    }
    const data = await response.json();
    
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    if (pageId === '-1') {
        throw new Error(`File not found on Wikimedia Commons: ${filename}`);
    }
    
    const imageUrl = pages[pageId]?.imageinfo?.[0]?.url;
    
    if (!imageUrl) {
        throw new Error(`Could not extract image URL from Wikimedia API response for ${filename}`);
    }
    
    return imageUrl;
};