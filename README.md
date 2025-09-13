# PillSenseAI — HopHacks2025

A medication safety assistant. Snap a prescription label → AI extracts medications and dose/frequency → checks for basic risks → lets you enable dose reminders. Built as a **monorepo** with a React (Vite) web app and an Express/MongoDB API. Optional Gemini fallback improves handwriting and multi‑med parsing.

---

## Features (MVP)

- **OCR & Parsing**: Tesseract.js + image preprocessing; optional **Gemini** structuring (text & vision) for tough images / multiple meds.
- **Drug rules (demo)**: simple interaction/overdose flags (e.g., warfarin × ibuprofen; acetaminophen > 4000 mg/day).
- **Plain-language note (demo)**: friendly explanation text.
- **User auth**: JWT; protected routes (only `/api/auth/*` open).
- **Reminders**: per‑med scheduling (demo cron logs + in‑app toast).
- **My Meds**: view active prescriptions; prevent duplicates.
- **Idempotent scans**: dedupe by med fields and (optional) exact-image cache.

---

## Tech Stack

- **Frontend**: React + Vite, CSS modules / utility classes
- **Backend**: Node + Express, MongoDB (Mongoose)
- **OCR**: Tesseract.js + sharp (libvips prebuilt)
- **LLM (optional)**: Google Gemini via `@google/generative-ai`
- **Auth**: JWT (http Authorization header)
- **Scheduling**: node-cron (demo only)

---

## Monorepo Layout

```
PillSenseAI/
├─ apps/
│  ├─ api/          # Express API (ESM)
│  └─ web/          # React + Vite app
├─ package.json     # npm workspaces
└─ README.md
```

---

## Prerequisites

- **Node.js**: 18+ recommended (works on 20/22).
- **MongoDB**: Atlas or local instance (URI in `.env`).
- (Optional) **Gemini** API key for better handwriting / multiple meds.

> Tesseract.js uses WebAssembly; no native Tesseract binary required. `sharp` ships prebuilt libvips for common platforms.

---

## Quick Start — Windows

1. **Clone & install**

```powershell
git clone <your-repo-url> PillSenseAI
cd PillSenseAI
npm install
```

If your corporate AV blocks postinstall downloads, allowlist `sharp` or run:

```powershell
npm rebuild sharp
```

2. **Configure env (API)**
   Create `apps/api/.env`:

```ini
PORT=5050
MONGO_URL=mongodb://localhost:27017/pillsenseai
JWT_SECRET=super-secret-change-me
CORS_ORIGIN=http://localhost:5173
# Optional: enable Gemini
GEMINI_API_KEY=your_key_here
GEMINI_TEXT_MODEL=gemini-1.5-flash
GEMINI_VISION_MODEL=gemini-1.5-flash
```

3. **Configure env (Web)**
   Create `apps/web/.env`:

```ini
VITE_API_URL=http://localhost:5050/api
```

4. **Run API**

```powershell
npm run dev -w apps/api
```

If you don’t have a dev script:

```powershell
node --env-file=apps/api/.env apps/api/src/index.js
```

5. **Run Web**
   Open a new terminal:

```powershell
npm run dev -w apps/web
```

Visit **http://localhost:5173**

---

## Quick Start — macOS

1. **Clone & install**

```bash
git clone <your-repo-url> PillSenseAI
cd PillSenseAI
npm install
```

2. **Configure env (API)**
   Create `apps/api/.env`:

```ini
PORT=5050
MONGO_URL=mongodb://127.0.0.1:27017/pillsenseai
JWT_SECRET=super-secret-change-me
CORS_ORIGIN=http://localhost:5173
# Optional: enable Gemini
GEMINI_API_KEY=your_key_here
GEMINI_TEXT_MODEL=gemini-1.5-flash
GEMINI_VISION_MODEL=gemini-1.5-flash
```

3. **Configure env (Web)**
   Create `apps/web/.env`:

```ini
VITE_API_URL=http://localhost:5050/api
```

4. **Run API**

```bash
npm run dev -w apps/api
# or
node --env-file=apps/api/.env apps/api/src/index.js
```

5. **Run Web**

```bash
npm run dev -w apps/web
```

Visit **http://localhost:5173**

---

## Usage

1. **Sign up / Log in** from the web app.
2. **Upload a prescription label** (clear, flat photo).
3. Review **Parsed Medications**. For tough images, configure **Gemini** to improve results.
4. Open **My Meds** to see saved prescriptions; toggle **reminders** per med.
5. You’ll see in‑app toasts when a dose is due (demo cron runs each minute and logs to the API console).

---

## Environment Variables (API)

| Name                  | Default                 | Notes                                |
| --------------------- | ----------------------- | ------------------------------------ |
| `PORT`                | `5050`                  | API port                             |
| `MONGO_URL`           |                         | Your MongoDB connection string       |
| `JWT_SECRET`          |                         | Any long random string               |
| `CORS_ORIGIN`         | `http://localhost:5173` | Comma‑separated list allowed origins |
| `GEMINI_API_KEY`      |                         | Optional; enables Gemini extraction  |
| `GEMINI_TEXT_MODEL`   | `gemini-1.5-flash`      |                                      |
| `GEMINI_VISION_MODEL` | `gemini-1.5-flash`      |                                      |

**Web**: `VITE_API_URL` should end with `/api`.

---

## Common Troubleshooting

### 1) `sharp` errors on Windows

- Ensure Node 18+ and run `npm rebuild sharp` in the repo.
- If behind a proxy, set `npm config set sharp_binary_host` is **not** necessary usually; just retry install.

### 2) CORS or “Make sure the API is running”

- Confirm `apps/web/.env` points to your API: `VITE_API_URL=http://localhost:5050/api`
- Confirm API console shows `API server running at http://localhost:5050`
- Ensure `CORS_ORIGIN` in `apps/api/.env` includes `http://localhost:5173`

### 3) `ERR_ERL_KEY_GEN_IPV6` from express-rate-limit

- Use the default key generator; don’t feed `req.ip` manually. Update express-rate-limit if needed.

### 4) Wrong reminder times after refresh

- Frontend stores your selected `HH:MM` in `localStorage` for display.
- If you changed timezones or want to reset, clear keys: `ps_time_*` in the browser’s localStorage.

### 5) Gemini not working

- Install SDK: `npm i -w apps/api @google/generative-ai`
- Set `GEMINI_API_KEY` in `apps/api/.env` and restart the API.
- Without Gemini, OCR still works, but handwriting & multi‑med parsing are less reliable.

---

## Scripts (may vary in your repo)

At the root:

```jsonc
{
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev:api": "npm run dev -w apps/api",
    "dev:web": "npm run dev -w apps/web"
  }
}
```

If missing, run API via `node apps/api/src/index.js` and web via `vite`/`npm run dev` inside `apps/web`.

---
