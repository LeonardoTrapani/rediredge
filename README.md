# Rediredge

**Blazing‑fast, self‑hostable domain redirector.**

> **Status:** Pre‑alpha — interfaces and storage schemas may change.

---

## Highlights

* **Instant redirects, zero cold starts.** A tiny Go redirector returns 30x in a single lookup.
* **Automatic HTTPS (proxy‑managed).** A front proxy handles TLS and ACME (on‑demand issuance and DNS‑01 wildcards).
* **Easy to self‑host.** One‑command **Docker Compose** templates; multiple templates will be available.
* **Hosted or self‑hosted.** Use our **hosted, horizontally‑scaled** service (no setup), or run it yourself for free.
* **Simple & powerful.** Clean Next.js dashboard & API, 307/308 method‑preserving redirects, path/query controls.
* **Portable & open.** Docker‑friendly, cloud‑agnostic, MIT‑licensed.

---

## What is Rediredge?

Rediredge pairs a **Go data plane** with a **Next.js control plane**. The control plane manages users, domains, and redirect rules; the data plane serves production traffic with a front proxy for TLS and a tiny Go service that issues instant 30x responses.

* **Data plane (edge):**

  * **Front proxy (default: Caddy)** — terminates TLS, obtains & renews certificates (ACME), and forwards HTTP to the app.
  * **Go redirector** — reads a compact lookup model from Redis and returns the redirect immediately.
* **Control plane (dashboard & API):**

  * **Next.js** app for auth, domains, and redirects; persists canonical configuration and publishes a read‑optimized view for the edge.

---

## Architecture

```mermaid
flowchart LR
  %% Shared infra (defined first so other sections can reference)
  subgraph SH[Shared infra]
    R[(Redis read model)]
  end

  %% Control plane
  subgraph CP[Control plane]
    UI[Dashboard + API<br>Next.js]
    PG[(Postgres)]
    OBQ[(Outbox events)]
    SW[Sync Worker]
    AW[Analytics Worker]
    UI --> PG
    UI --> OBQ
    OBQ --> SW
    SW -->|idempotent writes| R
    AW -->|BLPOP logs| R
    AW -->|batch update| PG
  end

  %% Data plane
  subgraph DP[Data plane]
    PXY[Proxy<br>TLS and ACME]
    EDGE[Go redirector<br>HTTP only]
    PXY -->|HTTP| EDGE
    EDGE -->|HGET| R
    R -->|response| EDGE
    EDGE -->|LPUSH logs| R
  end

  C[Client] -->|HTTPS| PXY
  EDGE -->|30x| C
  UI -->|billing| POLAR[(Polar billing)]
  AW -->|billing| POLAR
```

**Principles**

* The dashboard/API is **never on the hot path** for visitor traffic.
* Canonical config lives in Postgres; the edge reads a compact **Redis** view.
* TLS is managed by the **front proxy**; the Go redirector is **HTTP‑only** and stateless.
* Redirect analytics are logged asynchronously to Redis; a worker processes them in batches to update the database and Polar billing.
* Syncing via the Sync Worker ensures data consistency from Postgres to Redis for configurations.

---

## Deploying Rediredge

### 1) Hosted (no setup)

Use our **hosted, horizontally‑scaled** service. We operate a proxy tier that manages TLS/ACME and a fleet of Go redirectors. You bring your domains; we handle the rest (billing via Polar). Self‑hosting remains free.

### 2) Self‑host (Docker Compose)

Self‑hosting is **one command**. We'll ship **multiple templates**; the default template uses a front proxy in front of the Go app.

**Template A — Proxy‑in‑front (default)**

* **What it does**

  * Front proxy terminates TLS and obtains/renews certificates automatically.
  * Go redirector runs HTTP‑only and is fully stateless.
  * Redis stores the read‑optimized redirect map.

* **What you (the operator) add to DNS**

  * **Verification:** Add a **TXT** record at `_rediredge.example.com` with the verification token we provide (proves domain ownership).
  * **Routing:** Add a wildcard **CNAME** record `*.example.com` pointing to the redirector endpoint we provide (routes all subdomain traffic).
  * We'll provide provider‑specific copy‑paste instructions in the product UI.
  
  > **Note:** Currently supports subdomain redirects only (e.g., `cal.example.com`). Apex/root domain support (e.g., `example.com`) coming in a future release.

* **High availability (optional)**

  * Run multiple proxy instances and multiple Go instances; put them behind your load balancer. The proxy layer manages TLS; the Go layer scales horizontally.

> Additional templates (Traefik single‑node, Kubernetes with cert‑manager, etc.) will be published as we approach 1.0.

## How syncing works (Postgres → Redis)

We use the **Outbox Pattern** so writes are durable and Redis updates are reliable and idempotent.

```mermaid
sequenceDiagram
  autonumber
  participant UI as Dashboard (Next.js)
  participant API as API
  participant PG as Postgres (canonical)
  participant SW as Sync Worker
  participant R as Redis (read model)
  participant GO as Go Redirector

  UI->>API: Create/Update redirect
  API->>PG: Tx: write canonical rows
  API->>PG: Tx: insert outbox event (topic + payload)
  PG-->>API: Commit OK

  SW->>PG: Fetch unprocessed events
  SW->>R: Idempotent UPSERT (HSET map:<apex>:<sub> {..., version})
  SW->>PG: Mark event processed

  GO->>R: HGET map:<apex>:<sub>
  R-->>GO: dest, code, flags, version
  GO-->>C: 30x redirect
```

**Key guarantees**

* **Idempotence:** each rule carries a `version`; the worker only applies if the incoming version is not older than the stored one.
* **Resilience:** if Redis is down, events remain in the outbox and retry with backoff.
* **Rebuild:** a job can truncate the namespace and repopulate from Postgres at any time.

---

## Redirect rules & semantics

* **Status codes:** default **308** (permanent) and **307** (temporary). Both preserve HTTP method and body.
* **Path & query:** choose to preserve or rewrite; subdomains only (apex support coming soon).
* **Precedence:** exact host match wins; (future) wildcard rules come next; otherwise 404/410.
* **Reserved labels:** avoid system records like `mail`, `mx`, `autodiscover` if your DNS uses them.

**Example**

```json
{
  "redirect:example.com:cal": {
    "to": "https://calendly.com/acme",
    "status": 308,
    "preservePath": false,
    "preserveQuery": true,
    "enabled": true,
    "version": 3
  }
}
```

---

## Scaling & availability

* **Horizontally scalable by design.**

  * Scale the **proxy tier**: add more instances; they terminate TLS.
  * Scale the **Go tier**: add more redirectors; they are stateless and read from Redis.
* **Multi‑region (optional):**

  * Deploy proxy + Go in multiple regions; put a DNS policy (e.g., latency‑based) in front.
  * No anycast required for v1; the system still works great from a single region.

---

## Tech & development

* **Edge:** Front proxy (TLS + ACME + forwarding), Go redirector, Redis read model.
* **Control:** **Next.js** dashboard, auth, domains & redirects; Postgres (canonical), sync worker → Redis (read), analytics worker → Redis (logs).
* **Monorepo:** Turborepo; Bun scripts for dev/build/lint.

**Common commands**

```bash
# install deps
bun install

# dev (Next.js + worker + edge if configured)
bun run dev

# build all (includes Go CLI)
bun run build

# types across workspace
bun run check-types

# Go Redirector (from redirector/ workspace)
bun run --filter=@rediredge/redirector dev
bun run --filter=@rediredge/redirector test
bun run --filter=@rediredge/redirector lint

# database (Drizzle)
bun run db:push
bun run db:studio
bun run db:generate
bun run db:migrate
```

---

## Roadmap

* **0.1 (hosted preview):** core redirector, dashboard (Next.js), TXT domain verification, usage metering → Polar billing; **self‑host Docker Compose template (proxy‑in‑front)**.
* **0.2:** additional self‑host templates (Traefik single‑node; Kubernetes with cert‑manager), rebuild job, usage analytics pipeline, basic metrics export.
* **0.3:** organizations/workspaces, audit log, bulk rules import.
* **1.0:** full docs, stable product.

> Roadmap is indicative; items may shuffle as we gather feedback.

---

## Coming before 1.0 — other proxy options

We default to a proxy‑in‑front pattern and will ship **multiple templates**:

* **Traefik (single‑node):** easiest for small self‑hosts; ACME/renewal into a local `acme.json`. Not HA by itself.
* **Kubernetes (Traefik or NGINX) + cert‑manager:** cert‑manager handles ACME (incl. DNS‑01); certs live in **Secrets**; scale proxies/redirectors freely.
* **Nginx / HAProxy family:** classic stacks using Certbot or acme.sh. Great single‑node story; for HA, share cert storage or use K8s + cert‑manager.

Each template includes:

* DNS instructions (routing + verification),
* health checks and basic observability,
* zero‑downtime rollout guidance.

---

## License

[MIT](LICENSE)
