# Agentic AI Lead Research POC

## Objective

This Proof of Concept demonstrates an AI-powered outbound research system that takes a small set of account inputs and turns them into a usable sales brief.

Inputs:

- Company name
- Industry
- Company size
- Geography

The system is designed to:

- Identify likely decision-makers
- Gather company and individual insights
- Analyze signals such as hiring, growth, technology cues, and messaging themes
- Generate hyper-personalized outreach content
- Decide where to search
- Choose relevant signals
- Synthesize insights into an actionable recommendation
- Craft context-aware messaging for outbound use

## POC Scope

The current implementation is focused on validating the workflow and user experience rather than building a fully productionized sales intelligence platform.

In this POC, the system:

- Uses company website content as the primary live data source
- Uses OpenAI to infer likely buyers, synthesize insights, and generate messaging
- Produces structured output for sales operators in a frontend dashboard
- Includes fallback behavior so the app remains usable if model output is unavailable

This POC does not currently:

- Scrape LinkedIn directly
- Integrate CRM systems
- Persist account history in a database
- Run scheduled enrichment jobs
- Validate contacts against third-party enrichment providers

## User Flow

1. User enters company name, industry, company size, and geography.
2. Backend resolves the company website and fetches public website context where available.
3. System plans a search strategy and defines which research surfaces are relevant.
4. OpenAI infers likely decision-makers.
5. Backend extracts company signals from available context.
6. OpenAI synthesizes the account insights and recommends outreach direction.
7. OpenAI generates personalized messaging for:
   - Email
   - LinkedIn
   - Call opener
8. Frontend displays the output in a structured outbound research console.

## Tech Stack

### Frontend

- React
- Vite
- CSS

### Backend

- Node.js
- Express
- Axios
- dotenv

### AI Layer

- OpenAI Responses API
- Model currently configured as `gpt-4.1-mini`

### Deployment

- Render Blueprint
- Static frontend on Render
- Node backend on Render

## High-Level Architecture

### Frontend

The frontend acts as an operator console where the user:

- submits account inputs
- reviews the planned search strategy
- inspects decision-makers and company signals
- reads synthesized insights
- copies outbound messaging

### Backend

The backend orchestrates the full lead research pipeline:

- `resolveCompany`
  - resolves and fetches public website context
- `planSearchStrategy`
  - determines search surfaces and signal focus
- `findDecisionMakers`
  - uses OpenAI to infer likely stakeholders
- `getCompanySignals`
  - extracts hiring, growth, messaging, and technology signals
- `analyzeSignals`
  - synthesizes account priority, angle, and recommendations
- `generatePersonalizedContent`
  - creates outreach assets

### OpenAI Interaction

The backend sends structured prompts to OpenAI for:

- decision-maker inference
- account insight synthesis
- personalized outreach generation

The system logs request and response payloads in the backend console for debugging during the POC phase.

## APIs / Endpoints

### `POST /lead`

Runs the complete POC pipeline and returns:

- input summary
- search strategy
- company profile
- decision-makers
- company signals
- synthesized insights
- outreach content
- execution summary

### `GET /health`

Basic health check for backend uptime.

### `GET /debug/openai`

Returns OpenAI diagnostics such as:

- attempts
- successes
- failures
- fallback count
- last model used

### `GET /debug/test-openai`

Runs a minimal OpenAI call to confirm the configured key and model path are working.

## Prerequisites

To run locally:

- Node.js installed
- npm installed
- OpenAI API key

Environment variables:

### Backend

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_WEB_SEARCH_MODEL`

### Frontend

- `VITE_API_BASE_URL`

## Local Setup

### Backend

```bash
cd backend
copy .env.example .env
```

Set the actual `OPENAI_API_KEY` inside `backend/.env`.

Start backend:

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm run dev
```

Default frontend URL:

- `http://localhost:5173`

Default backend URL:

- `http://localhost:3001`

## Deployment Approach

The project is configured for deployment on Render using `render.yaml`.

Deployment model:

- Backend deployed as a Render web service
- Frontend deployed as a Render static site
- Frontend environment variable `VITE_API_BASE_URL` sourced from backend Render URL

## Current Outcomes

The POC successfully demonstrates:

- Input-driven account research flow
- Automated search strategy planning
- AI-inferred decision-maker suggestions
- Company signal extraction from public content
- AI-based synthesis of sales insights
- Personalized outreach generation
- Deployable frontend and backend structure

## Business Value Demonstrated

This POC shows how an AI agent can reduce manual pre-outreach research effort by:

- compressing account research time
- improving message specificity
- helping reps prioritize who to contact
- connecting company context with outreach messaging

## Known Limitations

- Decision-makers are inferred and may not always reflect current org charts
- LinkedIn is treated conceptually in the workflow but is not directly integrated
- Website analysis is limited to accessible public page content
- No persistence layer or user authentication is included
- No CRM integration is included in the current phase

## Recommended Next Steps

Suggested phase-2 improvements:

- integrate third-party enrichment APIs
- add real web search grounding for more live account signals
- introduce contact scoring and ranking
- store account research runs in a database
- add export/share workflow for SDR or AE teams
- add user authentication and saved sessions
- improve prompt guardrails and response validation

## Deliverables in This Repo

- React frontend for the outbound research console
- Express backend orchestration layer
- OpenAI integration
- Render deployment blueprint
- Debug endpoints for model verification and diagnostics

## Summary

This POC validates that a lightweight agentic workflow can turn a few basic company inputs into a sales-ready research brief with prioritized buyers, relevant signals, and personalized messaging. It provides a strong foundation for expanding into a more robust sales intelligence and outbound automation platform.
