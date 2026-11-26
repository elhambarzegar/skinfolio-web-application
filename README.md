# Sagedew

A wise guide to fresh skin. An independent skincare consultant (no brands, no stores, nothing to sell) that helps you see which products you actually need: intake → a routine built from what you own, with the reasoning shown → daily tick-offs and progress → changes explained and approved by you. Built as the real, database-backed successor to the Skinfolio capstone prototype.

> Naming note: the database, its Docker container and the Postgres user are still called `skinfolio` internally. They are invisible to users and renaming them would orphan existing local data; a production database is created fresh under whatever name you choose.

## Stack

- **Next.js** (App Router, TypeScript) — frontend and backend in one app
- **PostgreSQL** + **Prisma** — data
- **Auth.js** (Credentials provider, JWT sessions) — accounts
- **Tailwind CSS** — styling, using the design tokens carried over from the capstone prototype

## Local setup

1. **Start Postgres:**
   ```bash
   docker compose up -d
   ```
   This runs Postgres in Docker on port 5432. Docker Desktop must be open first.

2. **Environment variables:** `.env` is already set up for local dev (gitignored). If you need to recreate it, copy `.env.example` and fill in `AUTH_SECRET` (generate with `openssl rand -base64 32`).

3. **Install dependencies and set up the database:**
   ```bash
   npm install
   npx prisma migrate dev
   ```

4. **Run the app:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Current status

Phase 1 (Foundation) only: landing page, sign up, log in, an empty dashboard tied to a real account and a real database. No routine engine, product catalog, or check-ins yet — those are the next build phases.

## Project structure

- `prisma/schema.prisma` — full data model (users, intake, product catalog with an auditable source/confidence trail, routines, check-ins, escalations)
- `src/app` — pages and API routes
- `src/auth.ts` — Auth.js configuration
- `src/lib/prisma.ts` — Prisma client
