# AI Powered Lead Research Assistant - POC

This project is a complete starter POC for:

- Inputting `companyName`, `industry`, `companySize`, `geography`
- Inferring likely decision makers using OpenAI
- Generating hiring and growth signals from live website content when available
- Producing a personalized outreach message with OpenAI (or fallback template)

## Tech Stack

- Backend: Node.js + Express
- Frontend: React + Vite
- AI: OpenAI API (optional for first run)

## Project Structure

- `backend` - API and lead pipeline
- `frontend` - React UI

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

- company details
- likely decision makers (AI inferred)
- company signals
- insight summary
- personalized message

## Notes

- The backend now tries to fetch live website text from the company domain and uses it in analysis.
- If OpenAI key is missing or model output is invalid, fallback logic keeps the API stable.
