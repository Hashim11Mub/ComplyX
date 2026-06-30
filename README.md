# ComplyX

Arabic RTL fintech compliance checker frontend for Saudi financial regulations. The current version is a frontend-only Next.js prototype with mock compliance analysis, consultation chat, and browser-generated report export.

## What Is Included

- Next.js Arabic RTL command-center UI.
- React components for product intake, agent steps, compliance findings, and consultation chat.
- Mock Next.js API routes under `frontend/app/api`.
- Browser-generated HTML report download.
- Backend folder kept as a ready structure for future API/RAG implementation.
- Docker Compose setup for the frontend only.

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Notes

Backend work is intentionally deferred. When you are ready, implement the API contract documented in `backend/README.md` and replace the mock routes in `frontend/app/api`.
