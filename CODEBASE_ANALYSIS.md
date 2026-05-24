# LDS Scripture Scholar AI Assistant - Codebase Analysis

## Project Overview
A React/TypeScript web application providing an AI-powered scripture study assistant for Latter-Day Saints (LDS) scriptures. Uses Google Gemini as the LLM backend.

## Project Structure

```
Root/
├── App.tsx                          # Main app component
├── index.tsx                        # Entry point
├── index.html                       # HTML shell
├── types.ts                         # TypeScript type definitions
├── package.json                     # Dependencies
├── vite.config.ts                   # Vite bundler config
├── tsconfig.json                    # TypeScript config
├── manifest.json                    # PWA manifest
├── metadata.json                    # App metadata
├── sw.js                            # Service worker (PWA)
├── .gitignore
├── README.md
├── ENHANCEMENT_PLAN.md
├── AGENT_ENHANCEMENT_PLAN.md
├── AGENT_ENHANCEMENT_MASTER_PLAN.md
│
├── components/                      # UI Components (40+ files)
│   ├── ChatWindow.tsx               # Main chat interface
│   ├── ChatInput.tsx                # User input component
│   ├── MessageBubble.tsx            # Chat message display
│   ├── Sidebar.tsx                  # Navigation sidebar
│   ├── ScriptureAgentSidebar.tsx    # Scripture-specific sidebar
│   ├── ScripturePanel.tsx           # Scripture display panel
│   ├── BookOfMormonPanel.tsx        # Book of Mormon specific panel
│   ├── CrossReferencePanel.tsx      # Cross-reference display
│   ├── JournalPanel.tsx             # Study journal
│   ├── NotesPanel.tsx               # Study notes
│   ├── QuizIcon.tsx / MultiQuizView.tsx  # Quiz functionality
│   ├── StudyPlanView.tsx            # Study plan display
│   ├── SettingsModal.tsx            # Settings configuration
│   ├── DisclaimerModal.tsx          # Disclaimer display
│   ├── VoiceButton.tsx              # Voice input
│   ├── LoadingDots.tsx              # Loading indicator
│   ├── ImageWithFallback.tsx        # Image handling
│   └── [Icon components]            # Various SVG icons
│
├── contexts/
│   └── SettingsContext.tsx           # React context for settings
│
├── services/
│   └── geminiService.ts             # Google Gemini AI integration
│
├── utils/
│   ├── audio.ts                     # Audio utilities
│   └── file.ts                      # File utilities
│
└── data/                            # Scripture data (JSON)
    ├── old-testament.json
    ├── new-testament.json
    ├── book-of-mormon.json
    ├── book-of-mormon-part1.json
    ├── book-of-mormon-part2.json
    ├── doctrine-and-covenants.json
    └── pearl-of-great-price.json
```

## Key Technical Details

### 1. Entry Points
- **index.tsx**: React entry point, renders App
- **App.tsx**: Main application component orchestrating all UI
- **index.html**: HTML shell with PWA meta tags

### 2. AI/LLM Integration
- **services/geminiService.ts**: Google Gemini API integration
- Handles chat completions, streaming responses
- Likely includes system prompts for LDS scripture expertise

### 3. Core Features (from component analysis)
- **Chat Interface**: ChatWindow, ChatInput, MessageBubble
- **Scripture Display**: ScripturePanel, BookOfMormonPanel
- **Cross-References**: CrossReferencePanel
- **Study Tools**: JournalPanel, NotesPanel, StudyPlanView
- **Quiz System**: MultiQuizView for knowledge testing
- **Voice Input**: VoiceButton component
- **PWA Support**: sw.js, manifest.json for offline capability

### 4. Data Layer
- Full LDS canon in JSON format:
  - Old Testament
  - New Testament
  - Book of Mormon (split into parts for size)
  - Doctrine and Covenants
  - Pearl of Great Price

### 5. Configuration
- **vite.config.ts**: Vite bundler configuration
- **tsconfig.json**: TypeScript strict mode
- **manifest.json**: PWA configuration
- **contexts/SettingsContext.tsx**: User preferences

### 6. Existing Enhancement Plans
Three enhancement plan files exist:
- ENHANCEMENT_PLAN.md
- AGENT_ENHANCEMENT_PLAN.md
- AGENT_ENHANCEMENT_MASTER_PLAN.md

## Architecture Patterns

1. **Component-Based React**: Functional components with hooks
2. **Context API**: Settings management via React Context
3. **Service Layer**: Abstracted AI service (geminiService.ts)
4. **PWA**: Service worker for offline capability
5. **JSON Data**: Scripture data stored as static JSON files

## Dependencies (from package.json - need to read)
- React + TypeScript
- Vite (build tool)
- Google Gemini SDK
- Tailwind CSS (likely, based on component patterns)

## Areas for Enhancement (Initial Assessment)

### Agent Architecture
- Current: Direct Gemini API calls
- Needed: Agent framework with tool use, planning, memory

### Missing Features (likely)
- No formal tool/function calling architecture
- No agent memory/retention system
- No multi-step reasoning/planning
- Limited context window management
- No RAG (Retrieval Augmented Generation) for scriptures

### Potential Improvements
1. Implement tool-use architecture (hermes-agent pattern)
2. Add scripture retrieval tools
3. Add cross-reference lookup tools
4. Implement study session memory
5. Add planning capabilities for study plans
6. Enhance quiz generation with agent reasoning

## Next Steps Required
1. Read package.json for exact dependencies
2. Read geminiService.ts to understand current AI integration
3. Read App.tsx for application flow
4. Read types.ts for data structures
5. Read existing enhancement plans
6. Design agent architecture based on hermes-agent/openclaw patterns
