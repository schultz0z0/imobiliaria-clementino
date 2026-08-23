# Docker Environments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Docker Desktop development environment with hot reload and a VPS production Compose deployment integrated with the existing host-networked Traefik.

**Architecture:** Development runs Vite inside Node.js with a source bind mount and a Linux-only dependency volume. Production uses the existing multi-stage Dockerfile and Nginx image; Traefik discovers the standalone application Compose service through Docker labels and routes both apex and `www` domains over HTTPS.

**Tech Stack:** Docker Desktop, Docker Compose, Node.js 20, Vite 6, Nginx, Traefik Docker provider.

---

### Task 1: Development container

**Files:**
- Create: `Dockerfile.dev`
- Create: `compose.dev.yaml`

**Step 1: Verify the development Compose is absent**

Run: `docker compose -f compose.dev.yaml config`

Expected: FAIL because `compose.dev.yaml` does not exist.

**Step 2: Create the development image**

Create a Node 20 Alpine image that installs `package-lock.json` dependencies with `npm ci`, exposes port 4174, and starts `npm run dev`.

**Step 3: Create the development Compose service**

Configure the development build, `4174:4174`, a source bind mount, a named `/app/node_modules` volume, `CHOKIDAR_USEPOLLING=true`, and `DISABLE_HMR=false`.

**Step 4: Validate the Compose model**

Run: `docker compose -f compose.dev.yaml config`

Expected: PASS and render one `website` service plus the dependency volume.

**Step 5: Build the development image**

Run: `docker compose -f compose.dev.yaml build`

Expected: PASS with the Node.js image and dependencies built.

**Step 6: Commit**

```bash
git add Dockerfile.dev compose.dev.yaml
git commit -m "feat: add Docker development environment"
```

### Task 2: Production Compose and Traefik routing

**Files:**
- Create: `compose.prod.yaml`
- Create: `.env.production.example`

**Step 1: Verify the production Compose is absent**

Run: `docker compose --env-file .env.production.example -f compose.prod.yaml config`

Expected: FAIL because the Compose and environment example do not exist.

**Step 2: Add the environment example**

Define `COMPOSE_PROJECT_NAME=imobiliaria-clementino` and `DOMAIN=clementinoimoveis.com.br`. Do not add credentials or ACME configuration because those remain owned by the isolated Traefik deployment.

**Step 3: Create the production service**

Build the existing production `Dockerfile`, expose internal port 80, use `restart: unless-stopped`, add an Nginx HTTP healthcheck, and add Docker labels for:

- `traefik.enable=true`
- the apex HTTPS router on `websecure`
- TLS through `letsencrypt`
- the `www` HTTPS router
- a permanent `redirectregex` middleware from `www` to the apex domain
- the explicit Nginx load-balancer port 80

Do not add the Traefik service, a Compose dependency, a public host port, or an external proxy network.

**Step 4: Validate the production Compose model**

Run: `docker compose --env-file .env.production.example -f compose.prod.yaml config`

Expected: PASS with expanded host rules and no `ports` section.

**Step 5: Build the production image**

Run: `docker compose --env-file .env.production.example -f compose.prod.yaml build`

Expected: PASS through the Vite build and final Nginx stage.

**Step 6: Commit**

```bash
git add compose.prod.yaml .env.production.example
git commit -m "feat: add Traefik production deployment"
```

### Task 3: Operations documentation

**Files:**
- Modify: `README.md`

**Step 1: Document development operation**

Add commands to start, inspect logs, stop, and rebuild the Docker Desktop environment at `http://localhost:4174`.

**Step 2: Document production preparation**

Explain DNS prerequisites, creation of `.env.production` from the example, and the requirement that Traefik and the application use the same Docker Engine.

**Step 3: Document deployment and updates**

Add clone, build/start, logs, status, update, rollback guidance, and the `www` redirect behavior.

**Step 4: Verify documented commands and names**

Run: `rg -n "compose.dev.yaml|compose.prod.yaml|clementinoimoveis.com.br|localhost:4174" README.md`

Expected: all environment commands and endpoints are present.

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add Docker deployment guide"
```

### Task 4: End-to-end verification

**Files:**
- No production file changes expected.

**Step 1: Start and test development**

Run: `docker compose -f compose.dev.yaml up -d`

Run: `curl -I http://localhost:4174`

Expected: HTTP 200.

**Step 2: Stop development and start production locally**

Run: `docker compose -f compose.dev.yaml down`

Run: `docker compose --env-file .env.production.example -f compose.prod.yaml up -d`

**Step 3: Inspect health without publishing a production port**

Run: `docker compose --env-file .env.production.example -f compose.prod.yaml ps`

Expected: the production service is running and healthy.

Run an HTTP request from inside the production container against `http://127.0.0.1/`.

Expected: the generated site HTML is returned.

**Step 4: Run project verification**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands exit successfully.

**Step 5: Clean up local production container**

Run: `docker compose --env-file .env.production.example -f compose.prod.yaml down`

Expected: containers and the project network are removed; images and named development dependency volume remain reusable.

**Step 6: Inspect repository state**

Run: `git status --short --branch`

Expected: the branch contains only the planned commits and no unintended changes.
