# Macros Lab — Local setup

This repository contains a static frontend and a small Express server with MySQL-backed auth.

Quick start (local development):

1. Copy `.env.example` to `.env` and set your DB credentials and `JWT_SECRET`.

2. Create the database and tables (run the SQL in `sql/create_tables.sql`):

```sql
-- Run in your MySQL client
CREATE DATABASE IF NOT EXISTS macros_lab;
USE macros_lab;
-- see file sql/create_tables.sql for full content
```

3. Install dependencies (already installed in this workspace):

```pwsh
npm install
```

4. Start the server from project root:

```pwsh
npm start
```

5. Open the app:

- `http://localhost:3001/register.html` — register
- `http://localhost:3001/login.html` — login
- `http://localhost:3001/dashboard.html` — protected dashboard (requires cookie)

Security notes:

- In production set `NODE_ENV=production` and `JWT_SECRET` to a strong value.
- Serve over HTTPS and set cookie `secure: true`.
- CSRF protection uses double-submit cookie via `csrf_token` and `x-csrf-token` header.
- For scale, consider Redis for token revocation and cleanup of `revoked_tokens`.
 
Tracker feature (client + optional server persistence)
--------------------------------------------------

This repo now includes a client-side tracker available at `tracker.html` (uses Bootstrap, Chart.js, Font Awesome). It supports:
- Searchable plans (reads `data/diet-plans.json`).
- Expandable routines and running macro totals.
- Local progress entries stored in `localStorage` and a progress chart.
- Export selected plan or progress as CSV.

Server-backed persistence (optional):
- A lightweight API is available in `server-mysql.js`:
	- `GET /api/plans?search=...` — returns plans from `data/diet-plans.json` (server-side search).
	- `POST /api/progress` — save a progress entry (requires `x-csrf-token` header). If a valid JWT cookie is present the entry will be associated with the user.
	- `GET /api/progress` — fetch progress entries for the authenticated user, or anonymous entries when not logged in.

To enable DB-backed progress storage run the SQL migration:

```
mysql -u youruser -p yourdb < sql/create_plans_and_progress.sql
```

Ensure `.env` contains your DB credentials, then restart the Node server.

*** End of README
