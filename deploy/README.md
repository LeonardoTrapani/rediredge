# Deployment

This folder contains deployment configurations for the Rediredge data plane (Go redirector + Redis).

## Quick Start (VPS/Docker)

```bash
cd deploy
cp .env.example .env
# Edit .env and set REDIS_PASSWORD
docker-compose up -d
```

**Requirements:**
- Docker & Docker Compose
- Ports 5499, 5498, 6379 available
- DNS A records pointing to your server

**What runs:**
- Go redirector on ports 5499/5498 (handles TLS via autocert)
- Redis on port 6379 (for redirect lookups)
- Persistent volumes for certs and Redis data

## Documentation

See full deployment guides at: [docs.rediredge.com/self-hosting](../apps/fumadocs)

**Available guides:**
- VPS (Docker Compose) - ready
- Railway - coming soon
- Fly.io - coming soon
- Render - coming soon
- AWS - coming soon
- And more...

## Architecture

```
User Request → Redirector (Go) → Redis Lookup → 307/308 Redirect
                    ↓
                TLS via autocert
```

Control plane (Next.js dashboard) syncs domain/redirect data to Redis via sync worker.
