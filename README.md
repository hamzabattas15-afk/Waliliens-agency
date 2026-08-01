# Waliliens

Agency website: static frontend + an Express/TypeScript backend API.

- `frontend/` — static HTML/CSS/JS, no build step.
- `backend/` — Express + TypeScript API (Postgres via Prisma, Redis, BullMQ). See
  [`backend/README.md`](backend/README.md) for API details, endpoints, and local
  (non-Docker) dev setup.

## Docker Compose setup

There are two compose files, each with a distinct, non-overlapping job:

- **`./docker-compose.yml` (this file, repo root) — the full stack.** Builds and
  runs `postgres`, `redis`, `api`, and `frontend` together, plus a one-shot
  `migrate` profile for running Prisma migrations/seeding. This is what you use
  to run the whole app the way it'll actually be deployed.

  ```bash
  docker compose --profile migrate up --build migrate   # first run only
  docker compose up --build -d
  ```

  Frontend at `http://localhost:8080`, API at `http://localhost:3001`.

- **`backend/docker-compose.yml` — Postgres + Redis only**, for local backend
  development. It exists so you can run the backend directly on the host with
  `npm run dev` (fast reload via `tsx`) while still pointing at real Postgres
  and Redis, without rebuilding a Docker image on every change:

  ```bash
  cd backend
  docker compose up -d       # postgres + redis, published on localhost
  npm run dev                # backend runs on the host, not in Docker
  ```

### Why not one file, or three?

These two files used to both define an `api`/`migrate` service — nearly
identical, but not quite: the root file set `NODE_ENV: production` for the
`api` container's `environment:` block and the backend one didn't, so the
backend file's `api` service silently inherited `NODE_ENV=development` from
`.env` instead. That flips on `pino`'s `pino-pretty` transport in
`backend/src/config/logger.ts` — a devDependency that's absent from the
production image — and crashes the container on startup. Two files meant to
describe the same service had drifted without anyone changing either one on
purpose.

The fix is to only define the `api` (and `migrate`) service in one place. The
root file is the canonical "run everything" definition; `backend/docker-compose.yml`
is intentionally reduced to just the dependencies a locally-run backend needs,
so there's no second, divergent copy of the API's build/runtime config to keep
in sync. `backend/src/config/logger.ts` also now falls back to plain JSON
logging if `pino-pretty` can't be resolved, so this specific failure mode
can't recur even if the environment drifts some other way in the future.
