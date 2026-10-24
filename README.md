# Creator Desk — Refined Campaign Production Suite

A refreshed React + Express application for managing client campaign briefs, production assets, creative versions, task schedules, role-based approval workflows, and an optional Ollama-assisted production assistant.

## What's changed

- Professional, restrained light UI: consistent typographic scale, subdued forest-green accent, clear status chips, and accessible input styling.
- Refined sidebar and workspace breadcrumb with responsive mobile navigation.
- New campaign overview with live metrics sourced from campaign records, functional search, status filters, and delivery progress.
- Cleaner new-campaign modal and split-panel sign-in experience.
- In-app notification toasts instead of intrusive browser alert popups in production workflows.
- Safer backend defaults: development proxy corrected to port 4000, rotated sessions at sign-in, consistent logout cookie, exact CSRF path exceptions, guarded production settings, development tokens hidden in production, production account emails using Resend, email resend option, chat history scoped to its author, and stricter review-state transitions.
- A standalone, no-database HTTP smoke-test suite.

## Setup (Windows/macOS/Linux)

**Prerequisites:** Node.js 22+, a MongoDB database, and Ollama if you want AI-dependent functionality.

### 1. Backend

```bash
cd BackEnd
npm ci
```

Copy `.env.example` to `.env` and set at least `DB_URL` and `SESSION_SECRET`. Set a long random secret. For Ollama, download the models configured in `.env` and ensure the local service runs at `http://localhost:11434`.

For a fresh *development* database, you can populate demo accounts and campaign data:

```bash
npm run seed
npm run dev
```

The API listens on port **4000** by default. Existing demo-account passwords are defined in `BackEnd/utils/seed.js`; do **not** deploy seeded demo credentials to production.

### 2. Frontend

In another terminal:

```bash
cd Frontend
npm ci
npm run dev
```

Visit **http://localhost:5173**. The Vite development proxy forwards `/api` to port **4000**. The backend must be running for login and campaign data.

To check the frontend production compilation on a machine with dependencies installed:

```bash
cd Frontend
npm run build
```

### 3. Backend tests

The no-database smoke test works without MongoDB or Ollama:

```bash
cd BackEnd
npm run test:offline
```

The full integration tests require a reachable MongoDB with the expected seeded fixtures:

```bash
cd BackEnd
npm test
```

### Production deployment

- Provide a real `DB_URL` and a random `SESSION_SECRET` of at least 32 characters.
- Configure `FRONTEND_URL`, `COOKIE_SECURE=true` on HTTPS, appropriate `COOKIE_SAME_SITE`, and `TRUST_PROXY=true` only if you actually deploy behind a trusted reverse proxy.
- Configure `RESEND_API_KEY` and a verified `EMAIL_FROM` sender for account verification and password reset emails. The old `SMTP_*` example variables were never implemented and have been replaced with an actual HTTPS email transport.
- Never commit `.env`, use demo credentials in production, or serve local `uploads/` files publicly without application permissions.
- Run full integration, security, storage, and AI tests against the production-like stack before deployment.

## Screenshots

The `screenshots/` folder contains captured **React application screenshots with illustrative mocked API campaign data** (not AI-generated images and not actual production account data):

1. Desktop dashboard
2. Filtered dashboard
3. New campaign modal
4. Campaign workspace
5. Mobile dashboard
6. Mobile navigation
7. Sign-in

See `QA_REPORT.md` for verification status and important remaining checks.
