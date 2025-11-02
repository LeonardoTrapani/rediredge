# Deployment

This folder contains deployment configurations for the Rediredge data plane (Go redirector + Redis).

## VPS Deployment

Deploy Rediredge data plane on any VPS using Docker Compose. Works on Ubuntu, Debian, Fedora, etc.

### Prerequisites

- VPS with 1GB+ RAM, 10GB+ storage
- Ubuntu 22.04+ (or equivalent)
- Root/sudo access
- Public IP address
- Ports 5499, 5498, 6379 available

### Step 1: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### Step 2: Clone Repository

```bash
cd ~
git clone https://github.com/leonardotrapani/rediredge.git
cd rediredge/deploy
```

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Generate strong password
REDIS_PASSWORD=$(openssl rand -base64 32)

# Update .env
echo "REDIS_PASSWORD=$REDIS_PASSWORD" > .env

# Save password for later (control plane config)
echo "Redis password: $REDIS_PASSWORD"
```

### Step 4: Start Services

```bash
docker compose up -d
```

This starts:

- **redirector** on ports 5499/5498
- **redis** on port 6379

### Step 5: Verify Deployment

```bash
# Check services are running
docker compose ps

# Check logs
docker compose logs -f redirector
docker compose logs -f redis

# Test Redis connection
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping
# Should return: PONG
```

### Step 6: Configure Firewall

```bash
# Allow HTTP/HTTPS
sudo ufw allow 5499/tcp
sudo ufw allow 5498/tcp

# Allow Redis
sudo ufw allow 6379/tcp

# Enable firewall
sudo ufw enable
```

### Step 7: DNS Configuration

Point your domains to the server IP:

```
# A records
example.com.     IN  A  <YOUR_SERVER_IP>
*.example.com.   IN  A  <YOUR_SERVER_IP>
```

**Wait for DNS propagation** (use `dig example.com` to verify).

### Step 8: Connect Control Plane

In your control plane (Next.js dashboard) settings:

```bash
REDIS_URL=redis://:$REDIS_PASSWORD@<YOUR_SERVER_IP>:6379
```

Run sync to populate Redis:

```bash
curl -X POST https://your-dashboard.com/api/sync
```

### Step 9: Test Redirect

Add a redirect in the dashboard, then test:

```bash
curl -I http://example.com
# Should return 307/308 with Location header
```

### Maintenance

#### View Logs

```bash
cd ~/rediredge/deploy
docker compose logs -f
```

#### Restart Services

```bash
docker compose restart
```

#### Update Rediredge

```bash
cd ~/rediredge
git pull
cd deploy
docker compose down
docker compose build --no-cache
docker compose up -d
```

#### Backup Certificates

```bash
# Create backup
docker run --rm -v deploy_certs:/certs \
  -v $(pwd):/backup alpine \
  tar czf /backup/certs-backup.tar.gz -C /certs .

# Restore backup
docker run --rm -v deploy_certs:/certs \
  -v $(pwd):/backup alpine \
  tar xzf /backup/certs-backup.tar.gz -C /certs
```

#### Monitor Disk Usage

```bash
docker system df
docker volume ls
```

### Troubleshooting

#### Port Already in Use

```bash
# Check what's using port 5499/5498
sudo lsof -i :5499
sudo lsof -i :5498

# Common culprit: nginx/apache
sudo systemctl stop nginx
sudo systemctl disable nginx
```

#### Certificate Issues

```bash
# Check cert cache
docker compose exec redirector ls -la /certs

# Force cert renewal (delete and restart)
docker volume rm deploy_certs
docker compose restart redirector
```

#### Redis Connection Failed

```bash
# Test Redis
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping

# Check password in env
cat .env

# View Redis keys
docker compose exec redis redis-cli -a $REDIS_PASSWORD KEYS '*'
```

#### DNS Not Resolving

```bash
# Check DNS propagation
dig example.com
nslookup example.com

# Wait up to 48 hours for full propagation
```

### Security Recommendations

1. **Use strong Redis password** (32+ chars)
2. **Firewall Redis port** if control plane is on same server
3. **Regular backups** of cert volume
4. **Monitor logs** for suspicious activity
5. **Keep Docker updated**

### Cost Estimate

**VPS pricing (monthly):**

- 1GB RAM, 1 CPU: $4-6 (Hetzner, Vultr, DigitalOcean)
- 2GB RAM, 1 CPU: $10-12
- Bandwidth: Usually included (1TB+)

**Total:** $4-6/month for basic setup
