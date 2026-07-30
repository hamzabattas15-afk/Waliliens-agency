# Waliliens

Static frontend plus an Express/TypeScript API.

## Run With Docker

From this folder:

```bash
cp backend/.env.example backend/.env
```

Fill `backend/.env` with real JWT secrets and Resend settings, then run:

```bash
docker compose --profile migrate up --build migrate
docker compose up --build -d
```

Open the site at `http://localhost:8080`.

Useful endpoints:

- Frontend: `http://localhost:8080`
- API health: `http://localhost:3001/api/health`
- API docs: `http://localhost:3001/api/docs`

Seeded admin users:

- Admin: `admin@waliliens.com` / `Waliliens2025!`
- Viewer: `viewer@waliliens.com` / `Viewer2025!`
