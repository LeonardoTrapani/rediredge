## VPS Deployment

Deploy the **Rediredge data plane** (Go redirector) on any VPS using **Docker Compose**. Works on Ubuntu, Debian, Fedora, etc.

### Prerequisites

* VPS with 1 GB+ RAM, 10 GB+ storage
* Ubuntu 22.04+ (or equivalent)
* Root/sudo access
* Public IP address
* Ports 80 and 443 available (for HTTP/HTTPS)

---

### Step 1: Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

---

### Step 2: Clone Repository

```bash
cd ~
git clone https://github.com/leonardotrapani/rediredge.git
cd rediredge/redirector
```

---

### Step 3: Configure Environment

Create a `.env` file with your **managed Redis URL** (TLS enabled, e.g. Upstash or Redis Cloud):

```bash
cat > .env <<'EOF'
REDIS_URL=rediss://default:<YOUR_PASSWORD>@<YOUR_REDIS_HOST>:<YOUR_REDIS_PORT>/0
EOF
```

---

### Step 4: Docker Compose file

`deploy/docker-compose.yml`:

```yaml
services:
  redirector:
    build: ../redirector
    ports:
      - "80:5499"    # HTTP
      - "443:5498"   # HTTPS
    env_file: .env
    volumes:
      - certs:/certs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:5499/health"]
      interval: 30s
      timeout: 3s
      start_period: 15s

volumes:
  certs:
```

---

### Step 5: Start Service

```bash
docker compose up -d
```

Starts:

* **redirector** on ports 80 (HTTP) and 443 (HTTPS)

---

### Step 6: Verify Deployment

```bash
docker compose ps
docker compose logs -f redirector
```

If your app logs “**ACME obtained certificate**”, HTTPS is working.

---

### Step 7: Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### Step 8: DNS Setup

Point your domain or subdomain (e.g. `redirector.rediredge.app`) to your VPS IP:

```
redirector.rediredge.app.   IN  A   <YOUR_SERVER_IP>
```

Wait for propagation (`dig redirector.rediredge.app`).

---

### Step 9: Connect Control Plane

In the dashboard, follow the self-hosting instructions to connect your redis instance to our workers (enabling comunication between our control plane and your data plane).

---

### Step 10: Test Redirect

Create a redirect rule in the dashboard, then:

```bash
curl -I http://example.com
# Expect: 307/308 Location: https://target...
```

---

## Maintenance

### View Logs

```bash
docker compose logs -f
```

### Restart

```bash
docker compose restart
```

### Update Rediredge

```bash
cd ~/rediredge
git pull
cd deploy
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Backup Certificates

```bash
docker run --rm -v deploy_certs:/certs \
  -v $(pwd):/backup alpine \
  tar czf /backup/certs-backup.tar.gz -C /certs .

# Restore
docker run --rm -v deploy_certs:/certs \
  -v $(pwd):/backup alpine \
  tar xzf /backup/certs-backup.tar.gz -C /certs
```

### Disk Usage

```bash
docker system df
docker volume ls
```

---

## Troubleshooting

### Ports in Use

```bash
sudo lsof -i :80
sudo lsof -i :443
sudo systemctl stop nginx apache2
```

### Certificate Issues

```bash
docker compose exec redirector ls -la /certs
docker volume rm deploy_certs
docker compose restart redirector
```

### Redis Connection Failed

* Confirm `REDIS_URL` in `.env`
* Check managed Redis dashboard → test connection from local:

  ```bash
  redis-cli -u $REDIS_URL ping
  ```

### DNS Not Resolving

```bash
dig redirector.rediredge.app
nslookup redirector.rediredge.app
```

---

## Security Recommendations

1. **Use `rediss://` (TLS)** for Redis.
2. **Don’t expose 6379** publicly.
3. **Backup `/certs`** volume regularly.
4. **Keep Docker updated.**
5. **Use firewall + fail2ban** if public traffic is heavy.

---

## Cost Estimate

| VPS Plan             | CPU | RAM  | Cost (USD/mo) |
| -------------------- | --- | ---- | ------------- |
| Basic (Hetzner CX11) | 1   | 1 GB | ≈ $5          |
| Medium               | 1–2 | 2 GB | ≈ $10–12      |
| Redis Cloud/Upstash  | –   | –    | Free – $5     |

**Total:** ~ $5/month for production-ready self-hosted data plane.
