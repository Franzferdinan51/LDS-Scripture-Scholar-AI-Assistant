# LDS Scripture Scholar AI Assistant

An advanced, AI-powered study companion for the scriptures and teachings of The Church of Jesus Christ of Latter-day Saints. Built with a multi-agent architecture, tool use, and deep scripture integration.

All scripture data used in this application is publicly available and sourced from [Project Gutenberg](https://www.gutenberg.org/).

---

## Screenshots

<!-- Add screenshots here once available -->
<!--
![Scripture Scholar Chat](screenshots/chat.png)
![Scripture Reader](screenshots/scripture-reader.png)
![Cross-Reference Panel](screenshots/cross-references.png)
![Command Palette](screenshots/command-palette.png)
-->

---

## Features

### Multi-Provider AI Support

Connect to the AI provider that works best for you:

| Provider | Type | Voice Chat | Model Discovery |
|---|---|---|---|
| **Google Gemini** | Cloud | Yes | No |
| **LM Studio** | Local | No | Yes |
| **OpenRouter** | Cloud | No | Yes |
| **Docker MCP Toolkit** | Bridge | No | Yes |
| **MiniMax** | Cloud | No | Yes |

A **provider fallback system** lets you configure a backup provider and model, so if your primary provider is unavailable the app seamlessly falls over without losing your conversation.

### Agent System with Sub-Agents

Messages are routed to specialized sub-agents based on content analysis:

- **General Chat** -- Answers scripture questions with LDS source search capability
- **Research Agent** -- Deep research on gospel topics with multi-source verification
- **Study Planner** -- Creates structured, multi-day study plans with daily sessions and goals
- **Quiz Master** -- Generates interactive multiple-choice quizzes to test scripture knowledge
- **Lesson Prep** -- Prepares lesson outlines with discussion questions and key points

### Scripture Reader

Browse the complete text of all standard works:

- Old Testament
- New Testament
- Book of Mormon
- Doctrine and Covenants
- Pearl of Great Price

The **Scripture Agent sidebar** provides an AI assistant on the scripture reader page for asking questions about the current chapter, with inline commentary and cross-reference suggestions.

### Cross-Reference System

Input any scripture reference and receive a list of related verses with explanations of how they connect across the standard works. Powered by the `getCrossReferences` tool.

### Journal and Note-Taking

- **Voice Journal** -- Record your thoughts and impressions aloud. The app transcribes your entry and uses AI to provide a summary, identify key principles, and suggest a relevant scripture for further study.
- **My Notes** -- A persistent notepad for quick thoughts and study observations.

All data is stored locally in your browser (IndexedDB), so your work is always there when you return.

### Study Plans and Quizzes

- **Study Plan Creator** -- Generate structured, multi-day study plans on any gospel topic with daily reading assignments and reflection questions.
- **Quiz Master** -- Create multiple-choice quizzes to test your knowledge on scripture blocks or themes, with immediate feedback on answers.

### Lesson Preparation and FHE Planning

- **Lesson Prep Assistant** -- Research and outline a complete lesson or talk, including objectives, discussion points, supporting scriptures, and activities.
- **FHE Planner** -- Generate a full Family Home Evening plan with a song, scripture, lesson, activity, and treat idea, tailored to the ages of your children.

### Voice Chat

Engage in real-time, spoken conversations with the AI. Available exclusively with the **Google Gemini** provider. Also includes text-to-speech for AI responses.

### Thinking Mode

Configure the depth of the model's reasoning with three levels:

| Depth | Thinking Budget |
|---|---|
| **Light** | 1,024 tokens |
| **Medium** | 4,096 tokens |
| **Deep** | 16,384 tokens |

Accessed via the `/think` slash command or the chat mode selector.

### LDS-Focused Web Search

Search the web for current Church content, conference talks, and gospel topics. Results from authoritative LDS sources (ChurchofJesusChrist.org, BYU, Book of Mormon Central, FAIR Latter-day Saints, etc.) are automatically prioritized.

**Configurable search providers:**

| Provider | API Key Required | Notes |
|---|---|---|
| **DuckDuckGo** | No | Default; works out of the box |
| **Tavily** | Yes | AI-optimized search API |
| **Brave Search** | Yes | Generous free tier |
| **SearXNG** | No (self-hosted URL) | Self-hosted, privacy-focused |
| **Google Custom Search** | Yes (API key + CX) | High quality results |
| **Wikipedia** | No | Automatic fallback |

If the primary provider fails, the app falls back through DuckDuckGo to Wikipedia.

### Tool Use

The AI can invoke tools to ground its responses in real scripture data:

| Tool | Description |
|---|---|
| `searchScriptures` | Search across all standard works for passages matching a query |
| `getCrossReferences` | Find cross-references and related verses for a given scripture |
| `getScriptureText` | Retrieve the full text of a specific verse or chapter |
| `searchWeb` | Search LDS-focused web sources (ChurchofJesusChrist.org, Church news) for current information |
| `searchLdsWeb` | Search multiple authoritative LDS sources including official Church sites, scholarly repositories, and apologetics resources |
| `searchWikimediaImage` | Search Wikimedia Commons for Church-related images |

### Memory System

A multi-layer memory system enables personalization across sessions:

- **Episodic** -- Remembers past conversations and study sessions
- **Semantic** -- Stores key facts and principles you have discussed
- **Preference** -- Tracks your study level, preferred books, and interests

Memories include relevance scores that decay over time, access counts, and optional embeddings for semantic retrieval.

### Skills System

Built-in skills provide specialized study modes, each with its own system prompt and required tool set:

**Study Skills**
- **Scripture Deep Dive** -- Multi-layered verse analysis (historical, linguistic, doctrinal)
- **Topical Study** -- Systematic study across all scriptures on a chosen topic
- **Character Study** -- In-depth profiles of scriptural figures

**Research Skills**
- **Timeline Builder** -- Chronological construction of scriptural events
- **Parallel Passage Finder** -- Find parallel accounts across the standard works
- **Conference Talk Finder** -- Locate relevant General Conference talks

**Teaching Skills**
- **Gospel Doctrine Lesson Prep** -- Full lesson preparation with objectives and activities
- **FHE Planner** -- Age-appropriate Family Home Evening plans

**Devotional Skills**
- **Daily Study Companion** -- Guided daily study with reflection prompts
- **Memorization Helper** -- Scripture memorization with spaced repetition

Skills track effectiveness with use counts, success counts, and average ratings. Custom skills can also be created by users.

### Slash Commands

Quick actions accessible from the chat input:

| Command | Description |
|---|---|
| `/new` | Start a new chat |
| `/reset` | Reset current chat |
| `/compact` | Compress conversation context |
| `/search` | Search conversations |
| `/skill` | Activate a skill |
| `/retry` | Re-send last message |
| `/undo` | Remove last exchange |
| `/status` | Show system status |
| `/usage` | Show usage stats |
| `/think` | Set thinking depth (light / medium / deep) |
| `/verbose` | Toggle verbose mode |
| `/persona` | Set agent persona |
| `/insights` | Show study insights |
| `/dashboard` | Open study dashboard |
| `/reminders` | Open reminders |
| `/help` | Show all available commands |

### Command Palette

Press **Ctrl+K** to open a VS Code-style command palette with fuzzy search, tab autocomplete, and keyboard navigation across all commands and actions.

### Additional Features

- **Study Progress Tracking** -- Track daily study streaks, session history, and reading patterns
- **Reminders and Proactive Suggestions** -- Set study reminders and receive AI-generated suggestions
- **Google Grounding** -- Responses grounded with Google Search and Google Maps sources (Google Gemini only)
- **LM Studio MCP Integration** -- Connect to LM Studio 0.4.0+ MCP servers for extended tool capabilities with local models
- **Dark Theme UI** -- Sleek, responsive dark mode with floating chat input and sidebar navigation

---

## Tech Stack

- **React 19** + **TypeScript**
- **Tailwind CSS 3** for styling
- **Vite 6** for development and builds
- **Google GenAI SDK** (`@google/genai`) for Gemini integration
- **Xenova Transformers** (`@xenova/transformers`) for local embeddings
- **IndexedDB** (via `idb`) for persistent storage
- OpenAI-compatible endpoints for LM Studio, OpenRouter, MCP, and MiniMax providers

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- An API key for at least one supported provider

### Installation

```bash
git clone https://github.com/Franzferdinan51/LDS-Scripture-Scholar-AI-Assistant.git
cd LDS-Scripture-Scholar-AI-Assistant
npm install
```

### Running

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (default Vite port).

### Building for Production

```bash
npm run build
npm run preview
```

### Configuring API Keys

Open the in-app **Settings** modal (gear icon) to configure providers:

1. **Google Gemini** -- Enter your Google API key. Required for voice chat, text-to-speech, and Google Search grounding features.
2. **LM Studio** -- Enter your local server base URL (e.g., `http://localhost:1234/v1`). No API key needed for local instances. For MCP integration, ensure LM Studio 0.4.0+ is running with MCP servers configured.
3. **OpenRouter** -- Enter your OpenRouter API key, then refresh the model list to browse available models.
4. **Docker MCP Toolkit** -- Enter the base URL and access key for your MCP endpoint.
5. **MiniMax** -- Enter your MiniMax API key and base URL, then refresh the model list. The current default model family is `MiniMax-M2.7`, with `MiniMax-M2.7-highspeed` also available.

You can also configure a **fallback provider** and model in settings so the app gracefully degrades if your primary provider is unavailable.

### Search Provider Configuration

In the Settings modal, select your preferred web search provider under the Search section:

- **DuckDuckGo** -- Works immediately with no configuration. Good for general use.
- **Tavily** -- Enter your Tavily API key. AI-optimized search with high relevance. Sign up at [tavily.com](https://tavily.com/).
- **Brave Search** -- Enter your Brave Search API key. Sign up at [brave.com/search/api](https://brave.com/search/api/).
- **SearXNG** -- Enter the URL of your self-hosted SearXNG instance (e.g., `http://localhost:8080`). See [searxng.org](https://docs.searxng.org/) for setup.
- **Google Custom Search** -- Enter your Google API key and Custom Search Engine ID (CX). Set up at [programmablesearchengine.google.com](https://programmablesearchengine.google.com/).

All web searches automatically prioritize authoritative LDS domains including ChurchofJesusChrist.org, BYU, Book of Mormon Central, FAIR Latter-day Saints, and the Church News.

---

## Project Structure

```
lds-scripture-scholar/
  App.tsx                          -- Main application shell
  types.ts                         -- TypeScript type definitions
  components/
    ChatInput.tsx                  -- Chat input with slash commands
    CommandPalette.tsx             -- Ctrl+K command palette
    CrossReferencePanel.tsx        -- Cross-reference viewer
    JournalPanel.tsx               -- Voice journal and notes
    ScriptureAgentSidebar.tsx      -- Verse-by-verse study sidebar
    ScripturePanel.tsx             -- Scripture reader
    SettingsModal.tsx              -- Provider and search configuration
    ...
  services/
    agentRouter.ts                 -- Sub-agent routing and definitions
    agentLoop.ts                   -- Multi-turn agent loop (think/plan/act/reflect)
    providerCapabilities.ts        -- Provider feature registry
    tools.ts                       -- AI tool declarations
    toolExecutor.ts                -- Tool execution engine
    webSearchService.ts            -- Multi-provider web search
    skills.ts                      -- Built-in skill definitions
    memory.ts                      -- Memory extraction and retrieval
    storage.ts                     -- IndexedDB persistence
    ...
  data/                            -- Scripture JSON data files
  public/data/                     -- Static scripture data
```

---

## Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run build` to verify the project compiles
5. Commit with a clear message
6. Push to your fork and open a Pull Request

Please keep changes focused and ensure the build passes before submitting.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- All scripture data is publicly available and sourced from [Project Gutenberg](https://www.gutenberg.org/).
- Created by Franz Ferdinan.

---

**Open Source:** [https://github.com/Franzferdinan51/LDS-Scripture-Scholar-AI-Assistant](https://github.com/Franzferdinan51/LDS-Scripture-Scholar-AI-Assistant)
