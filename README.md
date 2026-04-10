# AI Powered Lead Research Assistant - POC

This project is a complete starter POC for:

- Inputting `companyName`, `industry`, `companySize`, `geography`
- Identifying likely decision-makers
- Gathering company and individual insights
- Analyzing hiring, growth, technology, and messaging signals
- Extracting intent signals from LinkedIn and hiring data
- Finalizing ICP criteria for target segments
- Mapping company footprint across regions
- Generating hyper-personalized outreach for email, LinkedIn, and calls
- Deciding where to search and which signals matter most for each account

## Tech Stack

- Backend: Node.js + Express
- Frontend: React + Vite
- AI: OpenAI API (optional for first run)

## Project Structure

- `backend` - API and lead pipeline
- `frontend` - React UI
- `render.yaml` - Render blueprint for one-click deployment

## Quick Start

1. Install root dependencies (already minimal):

```bash
npm install
```

2. Backend setup:

```bash
cd backend
copy .env.example .env
```

Then set `OPENAI_API_KEY` in `backend/.env` if you want real LLM output.
Important: `.env.example` is only a template and is not loaded by the backend.
If you want the hybrid enrichment flow, set `APIFY_TOKEN` plus the relevant `*_APIFY_ACTOR_ID` values in `backend/.env`.

3. Run backend:

```bash
npm run dev --prefix backend
```

4. Run frontend in a second terminal:

```bash
npm run dev --prefix frontend
```

5. Open the UI:

- [http://localhost:5173](http://localhost:5173)

## API

### POST `/lead`

Request body:

```json
{
  "companyName": "Stripe",
  "industry": "SaaS",
  "companySize": "1000-5000",
  "geography": "US"
}
```

Response includes:

- search strategy
- company details
- LinkedIn intent signals, if the scraping API is configured
- Indeed hiring trends, if the scraping API is configured
- Crunchbase funding signals, if the scraping API is configured
- likely decision makers
- company signals
- ICP criteria
- company footprint by region
- synthesized insights
- personalized outreach content

## Deploy on Render

This repo includes a root-level `render.yaml` so you can deploy both services from the same GitHub repository.

Services created:

- `agentic-ai-backend` - Node/Express API from `backend`
- `agentic-ai-frontend` - Static Vite app from `frontend`

Steps:

1. Push this repo to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select this GitHub repository.
4. Render will detect `render.yaml` and create both services.
5. In the backend service, set `OPENAI_API_KEY`.
6. Deploy the blueprint.

Render config notes:

- Frontend `VITE_API_BASE_URL` is sourced from the backend service URL.
- Backend health check is `/health`.
- The backend only reads `backend/.env` locally. It does not load `.env.example` in production.

## Notes

- The backend now tries to fetch live website text from the company domain and uses it in analysis.
- The backend can optionally call Apify-backed connectors for LinkedIn, Indeed, and Crunchbase signals.
- If OpenAI key is missing or model output is invalid, fallback logic keeps the API stable.
