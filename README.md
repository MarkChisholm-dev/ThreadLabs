# ThreadLabs

Build outfits from your real wardrobe photos, then plan, track, and improve what you wear.

ThreadLabs combines a visual outfit recommender, a graph-based builder, weather-aware daily picks, and wardrobe analytics in one local-first app.

## Screenshots

### Home and settings

![ThreadLabs home and tag settings](screenshots/Top.png)

### Wardrobe grid

![ThreadLabs wardrobe view](screenshots/2.png)

### Planner and analytics

![ThreadLabs outfit planner and closet analytics](screenshots/planner.png)

### Diagnostics mode

![ThreadLabs diagnostics panel](screenshots/diagnostic.png)

### AI assistant

![ThreadLabs AI assistant panel](screenshots/AI.png)

## What it is

- Photo-first wardrobe manager
- Outfit suggestions with weather + feedback-aware scoring
- Pure canvas Outfit Builder (LiteGraph) with constraints and variation generation
- Saved outfit library with edit/duplicate flow
- Planner + repeat avoidance + daily recommendation
- Wear analytics and diagnostics panel for API health

## Core Features

### Wardrobe and tagging

- Upload items with image, category, seasons, occasions, styles, and warmth
- Configurable tag system (categories, occasions, seasons, styles)
- Default tags are locked; custom tags are persistent and removable

![Wardrobe cards](screenshots/2.png)

### Outfit generation

- Suggest outfits from inventory
- One-click random outfit
- Missing-category detection with smart "what to buy" hints
- Like/skip feedback improves ranking over time

### Outfit Builder (Graph Lab)

- Node-based canvas for building named outfits
- Item lock behavior for pinned selections
- Constraint node (formality, warmth range, no-repeat behavior)
- Build 3 Variations node
- Validation badges (missing required item, category mismatch, low confidence)
- Compare mode tray for side-by-side variation review

### Saved outfits

- Save built outfits
- Edit mode: rename, swap items, resave
- Duplicate outfit as a new variant

### Planner and insights

- Calendar planner for assigning outfits to dates
- Repeat-avoidance for recent plans
- Weather-aware "What should I wear today?"
- Wear logging and analytics:
	- most worn
	- never worn
	- cost per wear (for items with a cost value)
	- category gaps

![Planner and insights](screenshots/planner.png)

### Diagnostics mode

- Bottom-of-home diagnostics panel
- Endpoint checks with latency and status:
	- `/api/health`
	- `/api/config`
	- `/api/items`
	- `/api/outfits/saved`

![Diagnostics mode](screenshots/diagnostic.png)

### Optional AI assistant (Ollama)

- Local assistant panel (home page)
- Powered by local Ollama model when enabled
- Disabled by default, safe fallback when not configured

![AI assistant panel](screenshots/AI.png)

#### Enable AI assistant locally

1. Install Ollama: https://ollama.com/download
2. Start Ollama:

```bash
ollama serve
```

3. Pull a model (default project model):

```bash
ollama pull llama3.1:8b
```

4. In `server/.env`, set:

```dotenv
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT_MS=30000
```

5. Restart the API server after updating env values.

#### Assistant behavior

- The UI assistant appears on the home page.
- If disabled, the panel stays visible and explains how to enable it.
- Backend supports both Ollama chat and older generate endpoints for compatibility.
- Responses are rendered as Markdown for cleaner lists and formatting.

## Tech Stack

- Frontend: React + Vite + React Router
- Backend: Node.js + Express + Multer
- Canvas graph: LiteGraph.js
- Persistence: local JSON database (`server/data/db.json`) + local uploads (`server/uploads`)

## Project Structure

```text
threadlabs/
	server/
		src/
		data/db.json
		uploads/
	web/
		src/
```

## Run locally

### One-command setup and run (all platforms)

From the project root:

```bash
npm run setup:run
```

### Windows one-click start

From the project root, double-click `install-and-run.bat`.

Or run it from Command Prompt:

```bat
install-and-run.bat
```

It will install dependencies and start both the API server and web app.

### macOS and Linux one-click start

From the project root:

```bash
./install-and-run.sh
```

1. Install dependencies

```bash
npm install
```

2. Start API + web app

```bash
npm run dev
```

3. Open

- App: http://localhost:5173
- API: http://localhost:4000

### Troubleshooting quick checks

- Verify Node and npm are installed: `node -v` and `npm -v`
- If ports are busy, stop old processes and rerun
- If API calls fail in browser, ensure backend is running on `http://localhost:4000`
- For CORS in custom environments, set `CORS_ORIGINS` in `server/.env`
- If assistant fails, verify Ollama is running: `curl http://127.0.0.1:11434/api/tags`
- If model is missing, run: `ollama pull llama3.1:8b` (or your configured model)

## Build

```bash
npm run build
```

## Environment

Copy `server/.env.example` to `server/.env` if needed.

- `PORT` (default: `4000`)
- `CORS_ORIGINS` (comma-separated allowed origins)
- `RATE_LIMIT_MAX` (API requests per 15 min window, default `300`)
- `EMBEDDING_PROVIDER` (`deterministic` or `external`)
- `EMBEDDING_MODEL` (metadata label for external provider)
- `OLLAMA_ENABLED` (`true` or `false`, default `false`)
- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` (default `llama3.1:8b`)
- `OLLAMA_TIMEOUT_MS` (assistant request timeout in ms, default `30000`)
- No API keys are required for local setup

## API Highlights

- `GET /api/items`
- `POST /api/items`
- `DELETE /api/items/:id`
- `POST /api/suggestions`
- `GET /api/outfits/random`
- `GET /api/outfits/saved`
- `POST /api/outfits/saved`
- `PUT /api/outfits/saved/:id`
- `POST /api/outfits/saved/:id/duplicate`
- `GET /api/planner`
- `POST /api/planner`
- `DELETE /api/planner/:id`
- `POST /api/wear-log`
- `GET /api/analytics`
- `POST /api/recommendation/daily`
- `GET /api/health`
- `GET /api/assistant/status`
- `POST /api/assistant/chat`

### Assistant API notes

- `GET /api/assistant/status`: reports whether assistant is enabled and which model is configured.
- `POST /api/assistant/chat`: accepts `message` and optional `history`, returns assistant reply text.
