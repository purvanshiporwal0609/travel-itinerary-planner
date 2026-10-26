# 🧭 Tripora — Personalized Travel Itinerary Planner

AI-powered full-stack app that generates, edits, regenerates and shares day-by-day travel itineraries.

**Stack:** React (Vite) · FastAPI · Supabase (Auth + Postgres) · any OpenAI-compatible LLM (default: Groq / Llama 3.3)

## Features
- Smart trip builder: destination, dates, budget, style, pace, group size, interests, notes
- AI itinerary (attractions, dining, stay, transport) with per-item cost estimates, validated with Pydantic
- Interactive itinerary view: inline edit, add/remove items, **regenerate a single day** with an instruction
- Live cost tracking vs. budget and per-person cost
- Supabase auth, saved trips dashboard, read-only **share link** for groups

## Architecture
```
React (Vite) ──JWT──▶ FastAPI ──▶ LLM API (JSON mode → Pydantic validation, retry)
      │                  └──────▶ Supabase Postgres (service key, rows scoped by user_id)
      └── Supabase Auth (email/password)
```

## Setup
### 1. Supabase
1. Create a project → SQL Editor → run `backend/supabase_schema.sql`.
2. Copy: Project URL, `anon` key (frontend), `service_role` key (backend only — never expose it).
3. (Dev tip) Auth → Providers → Email → disable "Confirm email" for faster testing.

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # fill in LLM_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env    # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev             # http://localhost:5173
```

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/itineraries/generate` | Generate + save a trip |
| GET | `/api/itineraries` | List my trips |
| GET/PUT/DELETE | `/api/itineraries/{id}` | Read / save edits / delete |
| POST | `/api/itineraries/{id}/regenerate-day` | Regenerate one day |
| POST | `/api/itineraries/{id}/share` | Toggle public read-only link |
| GET | `/api/shared/{id}` | Public shared trip |

## Deployment
- **Backend → Render/Railway:** root `backend`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; set env vars; set `FRONTEND_URL` to your frontend URL.
- **Frontend → Vercel/Netlify:** root `frontend`, build `npm run build`, output `dist`; set `VITE_*` vars with `VITE_API_URL` = backend URL. Add an SPA rewrite of all routes to `/index.html`.

## Using another LLM
Change `LLM_BASE_URL` / `LLM_MODEL`, e.g. OpenAI (`https://api.openai.com/v1`, `gpt-4o-mini`) or Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/`, `gemini-2.0-flash`).

## System requirements
Any dual-core CPU, 4 GB RAM (8 GB recommended), ~1 GB disk, Node 18+, Python 3.10+, internet access. No GPU needed.
