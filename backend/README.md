# Waliliens Backend API

Production-grade Express + TypeScript backend for the Waliliens agency website.

## Features

- **Contact Form Pipeline**: Input validation (`zod`), honeypot spam filter, Redis rate limiting (per-IP and per-email), lead persistence, background email notifications (`BullMQ` + `Resend`).
- **Admin API**: JWT authentication (`argon2` password hashing, httpOnly refresh token cookie, 15m access token), RBAC (`ADMIN` vs `VIEWER` roles), audit logging.
- **Lead Management**: Paginated & filterable leads listing, status update workflow.
- **Projects / Portfolio CMS**: CRUD endpoints for portfolio items with Redis caching (5 min TTL) and cache invalidation on mutation.
- **Security**: `helmet` headers with CSP for GSAP/Lenis/Turnstile CDNs, CORS whitelist, parameter pollution protection, SHA-256 IP hashing.
- **Observability**: Structured JSON logging (`pino`), Sentry hook, `/api/health` connectivity checks.
- **OpenAPI Documentation**: Swagger UI served at `/api/docs`.

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Docker & Docker Compose (for PostgreSQL & Redis)

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Generate secure JWT secrets for your `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Run Infrastructure with Docker

`backend/docker-compose.yml` only defines Postgres and Redis (published to the
host) — it's dependencies for running the backend directly with `npm run dev`,
not a full-stack file. Start them:

```bash
docker compose up -d
```

### 3. Install Dependencies & Seed Database

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
```

Default seeded credentials:
- **Admin**: `admin@waliliens.com` / `Waliliens2025!`
- **Viewer**: `viewer@waliliens.com` / `Viewer2025!`

### 4. Start Development Server

```bash
npm run dev
```

The server will be running at `http://localhost:3001`.
Interactive API documentation is available at `http://localhost:3001/api/docs`.

---

## Running with Docker (Full Stack)

The full stack (API + DB + Redis + frontend) is defined in the **repository
root's** `docker-compose.yml`, not this directory's — `backend/docker-compose.yml`
only has Postgres/Redis for local dev (see above). From the repo root:

```bash
docker compose --profile migrate up --build migrate   # first run only
docker compose up --build -d
```

The frontend is served at `http://localhost:8080`, the API at `http://localhost:3001`.
See the [root README](../README.md#docker-compose-setup) for why the two compose
files are split this way.

---

## Running Tests

Run the Vitest test suite (uses in-memory SQLite, no running database required):

```bash
npm test
```

For coverage report:

```bash
npm run test:coverage
```

---

## API Summary

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | System health check (DB + Redis) |
| `POST` | `/api/contact` | Public | Submit contact form inquiry |
| `GET` | `/api/projects` | Public | Get published portfolio projects (cached) |
| `POST` | `/api/auth/login` | Public | Admin login (issues JWT + cookie) |
| `POST` | `/api/auth/refresh` | Public | Refresh access token |
| `POST` | `/api/auth/logout` | Public | Clear refresh cookie |
| `GET` | `/api/admin/leads` | Admin / Viewer | List paginated leads with filters |
| `GET` | `/api/admin/leads/:id` | Admin / Viewer | Get lead details |
| `PATCH` | `/api/admin/leads/:id` | Admin | Update lead status |
| `GET` | `/api/admin/projects` | Admin | List all projects (including unpublished) |
| `POST` | `/api/admin/projects` | Admin | Create project |
| `PUT` | `/api/admin/projects/:id` | Admin | Update project |
| `DELETE` | `/api/admin/projects/:id` | Admin | Delete project |
