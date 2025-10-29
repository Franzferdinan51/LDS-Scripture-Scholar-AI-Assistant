import { GoogleGenAI, Chat, Session, LiveServerMessage, Modality, Type, GenerateContentResponse, Content } from "@google/genai";
import { ApiProviderSettings, ChatMode, Model, Message } from "../types";

const SYSTEM_INSTRUCTION = `You are an advanced agentic chatbot named "Scripture Scholar", created by Ryan Smith. You are an open-source project, and your code can be found at https://github.com/Franzferdinan51/LDS-Scripture-Scholar-AI-Assistant/tree/main. Your role is to act as an expert research assistant on the Book of Mormon and The Church of Jesus Christ of Latter-day Saints (LDS Church).

**Thinking Process:** Before providing your final answer, you MUST use <thinking>...</thinking> XML tags to outline your thought process, plan, and any self-correction. This is a scratchpad for your reasoning and will be hidden from the user.

**Knowledge & Verification Protocol:**
Your internal knowledge is not live and has a training cut-off date. You must operate under the assumption that your internal data may be outdated for any time-sensitive query. Today's date is {{TODAYS_DATE}}.

**Mandatory Search Protocol:** To ensure accuracy and relevance, you MUST adhere to the following protocol:
1.  **Recent Information:** For any query about recent events, news, General Conference talks, or information released after your training, you MUST use your search tools. Do not answer from memory.
2.  **Verification:** For any factual claim, statistic, or specific doctrinal detail, you MUST use your search tools to verify accuracy against official sources (e.g., ChurchofJesusChrist.org), even if you believe you know the answer. This is a critical step to prevent providing outdated or incorrect information.
3.  **Deeper Insight:** When a user asks for deeper insight, context, or comprehensive answers, you MUST use your search tools to find relevant talks, articles, and scriptures to provide a well-supported and thorough response.

Do not state your knowledge cut-off date to the user unless directly asked. Your primary directive is to provide the most current and accurate information by actively seeking it.

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
1.  **Deconstruct Request:** Analyze the user's prompt for the core \`topic\` and \`ages of children\`.
2.  **Plan & Research:** Formulate a plan.
    -   Use your search tool to find a relevant story, scripture, or Church video.
    -   Identify an age-appropriate song, activity, and treat idea.
3.  **Synthesize & Structure:** Assemble the plan using Markdown:
    -   **Topic:**
    -   **Opening Song:**
    -   **Scripture:**
    -   **Lesson:** A short, simple story or principle.
    -   **Activity:** A fun, interactive game or craft.
    -   **Closing Song:**
    -   **Prayer:**
    -   **Treat:** A simple treat suggestion.

You MUST use your search tool to find current and relevant source material.`;

function getSystemInstruction(chatMode: ChatMode): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const baseInstruction = SYSTEM_INSTRUCTION.replace('{{TODAYS_DATE}}', today);
  
  switch (chatMode) {
    case 'study-plan': return STUDY_PLAN_SYSTEM_INSTRUCTION;
    case 'multi-quiz': return MULTI_QUIZ_SYSTEM_INSTRUCTION;
    case 'lesson-prep': return LESSON_PREP_SYSTEM_INSTRUCTION;
    case 'fhe-planner': return FHE_PLANNER_SYSTEM_INSTRUCTION;
    case 'chat':
    case 'thinking':
    default:
      return baseInstruction;
  }
}

const toGeminiHistory = (history: Message[]): Content[] => {
    const relevantMessages = history.filter(m => !m.isSuggestion && m.id !== 'initial-message');
    return relevantMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    })).filter(c => c.parts[0].text);
};


export const createChatService = (settings: ApiProviderSettings, chatMode: ChatMode, history: Message[]) => {
    if (settings.provider === 'google') {
        if (!settings.googleApiKey) throw new Error("Google API Key is not set.");
        const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });
        
        const modelName = ['study-plan', 'multi-quiz', 'lesson-prep', 'fhe-planner'].includes(chatMode)
            ? 'gemini-2.5-pro'
            : settings.model || 'gemini-flash-lite-latest';
            
        const chat = ai.chats.create({
            model: modelName,
            history: toGeminiHistory(history),
            config: {
                systemInstruction: getSystemInstruction(chatMode),
                tools: [{ googleSearch: {} }],
            }
        });
        
        return {
            sendMessageStream: async ({ message }: { message: string }) => {
                return chat.sendMessageStream({ message });
            }
        };
    } else {
        let baseUrl = '';
        let apiKey = '';
        switch(settings.provider) {
            case 'lmstudio': baseUrl = settings.lmStudioBaseUrl; break;
            case 'openrouter': 
                baseUrl = settings.openRouterBaseUrl; 
                apiKey = settings.openRouterApiKey;
                break;
            case 'mcp': baseUrl = settings.mcpBaseUrl; break;
        }

        const sendMessageStream = async function* ({ message }: { message: string }): AsyncGenerator<GenerateContentResponse> {
            const systemInstruction = getSystemInstruction(chatMode);
            const messages = [
                { role: 'system', content: systemInstruction },
                ...history.filter(m => m.id !== 'initial-message' && m.text).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
                { role: 'user', content: message }
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
                                yield { text } as any; // Cast to fit the expected type
                            }
                        } catch (e) {
                            console.error('Error parsing stream chunk:', e, jsonStr);
                        }
                    }
                }
            }
        };
        
        return { sendMessageStream };
    }
};

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

export const fetchModels = async (settings: ApiProviderSettings): Promise<Model[]> => {
    let url: string;
    let headers: Record<string, string> = {};

    switch (settings.provider) {
        case 'lmstudio':
        case 'mcp':
            url = settings.provider === 'lmstudio' ? `${settings.lmStudioBaseUrl}/models` : `${settings.mcpBaseUrl}/models`;
            break;
        case 'openrouter':
            url = `${settings.openRouterBaseUrl}/models`;
            headers['Authorization'] = `Bearer ${settings.openRouterApiKey}`;
            break;
        default:
            return [];
    }
    
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