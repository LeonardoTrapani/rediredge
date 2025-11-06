# VPS Deployment (Debian)

Deploy the **Rediredge data plane** (Go redirector) on a Debian VPS using **Docker Compose**.

## Prerequisites

* Debian 12 (Bookworm) or 11 (Bullseye)
* 1 GB+ RAM, 10 GB+ storage
* Root/sudo
* Public IPv4
* Ports **80** and **443** free

---

## Step 0: Base packages (Debian)

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw dnsutils lsof
sudo install -m 0755 -d /etc/apt/keyrings
```

---

## Step 1: Install Docker (Compose v2 included)

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# optional: run Docker as your user
sudo usermod -aG docker $USER
newgrp docker  # or log out/in

docker --version
docker compose version
```

---

## Step 2: Clone repository

```bash
cd ~
git clone https://github.com/leonardotrapani/rediredge.git
cd rediredge/redirector
```

---

## Step 3: Configure environment

Create `.env` **in `rediredge/redirector/`** with your managed Redis URL (TLS):

We reccomend using something like Upstash for serverless redis (to easily horizontal scaling when needed), but any redis instance is fine.

```bash
mkdir -p deploy
cat > deploy/.env <<'EOF'
REDIS_URL=rediss://default:<YOUR_PASSWORD>@<YOUR_REDIS_HOST>:<YOUR_REDIS_PORT>/0
EOF
```

---

## Step 5: Build & start

```bash
cd ~/rediredge/redirector
docker compose up -d --build
```

Starts:

* **redirector** on **80/443**

---

## Step 6: Verify

```bash
docker compose ps
docker compose logs -f redirector
```

Look for: **“ACME obtained certificate”** → HTTPS OK.

---

## Step 7: Firewall (Debian)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Step 8: DNS

Point your domain/subdomain to your VPS IP:

```
redirector.rediredge.app.   IN  A   <YOUR_SERVER_IP>
```

Check:

```bash
dig +short redirector.rediredge.app
```

---

## Step 9: Connect Control Plane

In the dashboard, follow the self-hosting steps and supply your Redis URL to link control plane ↔ data plane.

---

## Step 10: Test redirect

Create a rule in the dashboard, then:

```bash
curl -I http://example.com
# Expect: 307/308 with Location: https://target...
```

---

# Maintenance

## Logs

```bash
cd ~/rediredge/deploy
docker compose logs -f
```

## Restart

```bash
docker compose restart
```

## Update Rediredge

```bash
cd ~/rediredge
git pull
cd deploy
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Backup certificates (Compose project dir is “deploy” → volume name `deploy_certs`)

```bash
# Backup
docker run --rm -v deploy_certs:/certs \
  -v "$(pwd)":/backup alpine \
  sh -c 'tar czf /backup/certs-backup.tar.gz -C /certs .'

# Restore
docker run --rm -v deploy_certs:/certs \
  -v "$(pwd)":/backup alpine \
  sh -c 'tar xzf /backup/certs-backup.tar.gz -C /certs'
```

## Disk usage

```bash
docker system df
docker volume ls
```

---

# Troubleshooting

## Ports in use

```bash
sudo lsof -i :80
sudo lsof -i :443
sudo systemctl stop nginx apache2
```

## Certificate issues

```bash
docker compose exec redirector ls -la /certs
docker volume rm deploy_certs
docker compose restart redirector
```

## Redis connection failed

* Verify `REDIS_URL` in `deploy/.env`
* Quick test without installing redis-cli on host:

```bash
docker run --rm redis:7-alpine redis-cli -u "$(grep REDIS_URL deploy/.env | cut -d= -f2)" ping
```

## DNS not resolving

```bash
dig redirector.rediredge.app
nslookup redirector.rediredge.app
```

---

# Security

1. Use **`rediss://`** (TLS) for Redis.
2. Don’t expose **6379**.
3. Backup the **`/certs`** volume.
4. Keep Docker updated.
5. Use **ufw**; add **fail2ban** if needed: `sudo apt install -y fail2ban`.

---

# Cost Estimate

| VPS Plan             | CPU | RAM  | Cost (USD/mo) |
| -------------------- | --- | ---- | ------------- |
| Basic (Hetzner CX11) | 1   | 1 GB | ≈ $5          |
| Medium               | 1–2 | 2 GB | ≈ $10–12      |
| Redis Cloud/Upstash  | –   | –    | Free – $5     |

**Total:** ~ **$5/mo** for a production-ready self-hosted data plane on Debian.
