# Scripture Scholar

Welcome to Scripture Scholar, an advanced, AI-powered agentic chatbot designed to be an expert research assistant for the scriptures and teachings of The Church of Jesus Christ of Latter-day Saints.

This application was created by **Ryan**. All scripture data used in this application is publicly available and sourced from Project Gutenberg.

## Core Features

*   **Intelligent Scripture Chat:** Engage in natural language conversations to explore topics, ask questions, and gain insights into the scriptures.
*   **Multi-Provider API Support:** Flexibly connect to various large language models through Google Gemini, OpenRouter, or a local LM Studio instance.
*   **Specialized Agentic Modes:** Go beyond simple chat with purpose-built modes for specific tasks:
    *   **Thinking Mode:** Utilizes the powerful `gemini-2.5-pro` model with a maximum thinking budget for deep, complex queries that require advanced reasoning.
    *   **Study Plan Creator:** Automatically generate structured, multi-day study plans on any gospel topic.
    *   **Quiz Master:** Create multiple-choice quizzes to test your knowledge on scripture blocks or themes.
    *   **Lesson Prep Assistant:** An agentic tool that researches and outlines a complete lesson or talk, including an objective, discussion points, scriptures, and activities.
    *   **FHE Planner:** Quickly generate a full Family Home Evening plan with a song, scripture, lesson, activity, and treat idea, tailored to the ages of your children.
*   **Comprehensive Study Suite:** A full set of tools to enhance your learning:
    *   **Scripture Reader:** Browse the complete text of the Old Testament, New Testament, Book of Mormon, Doctrine and Covenants, and Pearl of Great Price.
    *   **Voice Journal:** Record your thoughts and impressions aloud. The app transcribes your entry and uses AI to provide a summary, identify key principles, and suggest a relevant scripture for further study.
    *   **Cross-Referencer:** Input any scripture and get a list of related verses with explanations of how they connect.
    *   **My Notes:** A simple, persistent notepad for jotting down quick thoughts.
*   **Rich Multimedia & Grounded Responses:**
    *   **Voice Chat:** Engage in real-time, spoken conversations with the AI (Google Gemini only).
    *   **Text-to-Speech:** Listen to the AI's responses.
    *   **Agentic Image Search:** Ask the AI to find relevant images (e.g., "Find a picture of the Salt Lake Temple"), and it will search Wikimedia Commons for official, church-related images.
    *   **Grounding:** Responses are grounded with sources from Google Search and Google Maps (model dependent) for enhanced accuracy.
*   **Persistent & Personalized:** Your chat history, notes, and journal entries are automatically saved to your browser's local storage, so your work is always there when you return.
*   **Modern UI/UX:** Features a sleek, responsive dark mode, a floating chat input, and an intuitive, sidebar-based navigation system.

## Technology Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS
*   **AI/LLM Integration:** Google Gemini API (`@google/genai`)
*   **API Abstraction:** Supports OpenAI-compatible endpoints for providers like OpenRouter and LM Studio.

## Data Sources

The scripture text used in this application is from the public domain, provided by **Project Gutenberg**.

*   **The Holy Bible, King James Version:** [Project Gutenberg eBook #10](https://www.gutenberg.org/ebooks/10)
*   **The Book of Mormon:** [Project Gutenberg eBook #17](https://www.gutenberg.org/ebooks/17)
*   **The Doctrine and Covenants:** [Project Gutenberg eBook #58999](https://www.gutenberg.org/ebooks/58999)
*   **The Pearl of Great Price:** [Project Gutenberg eBook #19438](https://www.gutenberg.org/ebooks/19438)

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    ```
2.  **Install dependencies:**
    This project uses a modern web setup with `importmap`, so no `npm install` is required for the core libraries.
3.  **Configure API Keys:**
    *   This app is designed to work out-of-the-box using the pre-configured `API_KEY` environment variable.
    *   You can also configure other providers (like OpenRouter or a local LM Studio instance) and manage your Google API key in the in-app settings menu.
4.  **Run the application:**
    Serve the project directory using a simple local web server. For example, using Python:
    ```bash
    python -m http.server
    ```
    Or using a tool like `live-server` for automatic reloading. Open the provided URL in your browser.