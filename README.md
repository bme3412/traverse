# Traverse

**Three AI agents that review your visa application the way an experienced immigration team would.**

Upload documents in any language. Traverse's Research, Document Intelligence, and Advisory agents coordinate to catch the errors that cause preventable rejections — across documents, across languages, for any corridor in the world.

## Architecture

```
User Input (corridor + documents)
        │
        ▼
┌──────────────────────────────────────────────┐
│          ORCHESTRATOR (TypeScript)            │
│  Plans analysis, delegates to agents,        │
│  handles data passing, streams to UI         │
└────┬───────────────┬───────────────┬─────────┘
     │               │               │
     ▼               ▼               ▼
┌──────────┐  ┌─────────────┐  ┌──────────┐
│ RESEARCH │  │  DOCUMENT   │  │ ADVISORY │
│  AGENT   │  │INTELLIGENCE │  │  AGENT   │
│          │  │   AGENT     │  │          │
│Web Search│  │Vision       │  │Thinking  │
│Thinking  │  │Thinking     │  │Structured│
│          │  │             │  │Output    │
└──────────┘  └─────────────┘  └──────────┘
```

All three agents use **Claude Opus 4.6** with adaptive thinking — dynamically allocating reasoning depth based on complexity.

## How It Works

1. **Research Agent** — Searches live government sources for current visa requirements for your specific corridor
2. **Document Intelligence Agent** — Reads your uploaded documents in any language using multimodal vision, detects cross-lingual contradictions, assesses narrative coherence
3. **Advisory Agent** — Synthesizes everything into prioritized, actionable guidance

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Anthropic SDK (`claude-opus-4-6`) — web search, vision, adaptive thinking
- Vercel (deployment)
- No database — stateless, documents processed in-memory

## Getting Started

```bash
npm install
cp .env.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Privacy

- **No database.** No user data stored anywhere.
- **No accounts.** No login, no signup, no tracking cookies.
- **In-memory only.** Documents are base64-encoded in the browser, sent to the API route, processed, and discarded.
- **No server-side file storage.**

## Demo Documents

The `demo-docs/` directory contains synthetic documents for demonstration purposes. All data is fictional — no real PII anywhere.

## License

MIT
