# Environment Variables

## Backend

Copy `backend/.env.example` to `backend/.env`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/revive_crm?schema=public"
PORT=4000
TRUST_PROXY_HOPS=0
NODE_ENV=development
JWT_ACCESS_SECRET=replace-with-access-secret
JWT_REFRESH_SECRET=replace-with-refresh-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
REFRESH_TOKEN_DAYS=7
REFRESH_TOKEN_COOKIE_NAME=revive_refresh_token
COOKIE_DOMAIN=
FRONTEND_URL=http://localhost:3000
FRONTEND_URLS=http://localhost:3001,https://your-website.example
FILE_STORAGE_PROVIDER=local
FILE_STORAGE_ROOT=storage/private
```

## Frontend

Copy `frontend/.env.example` to `frontend/.env.local`.

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Hostinger production uses the canonical `deploy/hostinger/.env.hostinger.example`. It requires the internal PostgreSQL/MinIO service hostnames, independent high-entropy secrets, a base64 32-byte `FILE_ENCRYPTION_KEY`, `TRUST_PROXY_HOPS=1`, and exact HTTPS domains. See [`deployment.md`](./deployment.md).
