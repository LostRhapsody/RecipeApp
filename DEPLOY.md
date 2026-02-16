# Deployment Guide

Two options for running this app beyond `bun run dev`. **TL;DR: Option B (Local + Tailscale) is recommended** because the local LLM needs real hardware and SQLite is happiest on a local disk.

---

## Option A: Railway

Railway can host the Nuxt app, but there are trade-offs:

- **SQLite** needs a persistent volume (Railway's filesystem is ephemeral).
- **Qwen3-4B** needs \~4 GB RAM at minimum on CPU and will be *slow* without a GPU. Railway doesn't offer GPU instances, so the LLM review feature will either be unusable or you'd need to swap it for a cloud API (OpenRouter, Together, etc.).
- **Cost**: Hobby plan is $5/month + usage. A volume + enough RAM for the LLM gets expensive fast.

If you only care about scraping/storage and are fine disabling or replacing the LLM, Railway works well.

### Steps

#### 1. Add a production start script

In `package.json`, add:

```json
"scripts": {
  "start": "node .output/server/index.mjs"
}
```

#### 2. Make the SQLite path configurable

Railway volumes mount at a fixed path. Update `server/database/index.ts` to use an env var:

```ts
const dbPath = process.env.DATABASE_PATH || "sqlite.db"
const sqlite = new Database(dbPath)
```

#### 3. Create a Dockerfile

```dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/.output .output
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

#### 4. Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login & init
railway login
railway init

# Add a volume for SQLite persistence
railway volume add --mount /data

# Set environment variables
railway variables set DATABASE_PATH=/data/sqlite.db
railway variables set NUXT_PUBLIC_SITE_URL=https://your-app.up.railway.app
# If using a cloud LLM instead of local llama.cpp:
# railway variables set NUXT_LLAMA_BASE_URL=https://openrouter.ai/api/v1

# Deploy
railway up
```

#### 5. Restrict access (pick one)

**Option 5a: Basic auth middleware (simplest)**

Create `server/middleware/auth.ts`:

```ts
export default defineEventHandler((event) => {
  // Skip auth for health checks
  if (getRequestURL(event).pathname === "/health") return

  const auth = getHeader(event, "authorization")
  const expected = `Basic ${btoa(useRuntimeConfig().authCredentials)}`

  if (auth !== expected) {
    setResponseStatus(event, 401)
    setResponseHeader(event, "WWW-Authenticate", 'Basic realm="Recipe App"')
    return "Unauthorized"
  }
})
```

Add to `nuxt.config.ts`:

```ts
runtimeConfig: {
  llamaBaseUrl: "http://127.0.0.1:8081",
  authCredentials: "", // set via NUXT_AUTH_CREDENTIALS env var ("user:pass")
}
```

Then set the env var on Railway:

```bash
railway variables set NUXT_AUTH_CREDENTIALS=youruser:yourpassword
```

Your browser will prompt for the username/password on first visit.

**Option 5b: Cloudflare Access (more robust)**

If you point a custom domain at your Railway app through Cloudflare:

1. Go to Cloudflare Zero Trust > Access > Applications.
2. Add a self-hosted app with your domain.
3. Create a policy: **Allow** > **Emails** > your email.
4. All requests now go through Cloudflare's login page first.

This is the gold standard for "only I can access it" without touching app code.

---

## Option B: Local + Tailscale (Recommended)

Run the app on your local machine (or a home server) and use Tailscale to securely access it from any device. This gives you:

- Full GPU access for the LLM
- SQLite on a real filesystem (fast, no volume hacks)
- Zero cloud costs
- WireGuard encryption between all your devices
- No ports exposed to the public internet

### Steps

#### 1. Install Tailscale

Install on every device you want to access the app from:

- **Windows**: https://tailscale.com/download/windows
- **macOS**: `brew install tailscale` or App Store
- **iOS/Android**: App Store / Play Store
- **Linux**: https://tailscale.com/download/linux

Sign in with the same account on each device. They'll automatically join your private network (called a "tailnet").

#### 2. Build and run the app

```bash
bun install
bun run build
```

Start the Nuxt production server:

```bash
# Bind to all interfaces so Tailscale can reach it
HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs
```

#### 3. Start the LLM server

Download a Qwen3-4B GGUF model and start llama.cpp:

```bash
# Example with llama-server (adjust path to your model)
llama-server --model "C:\Users\evanr\.ollama\models\blobs\sha256-3e4cb14174460404e7a233e531675303b2fbf7749c02f91864fe311ab6344e4f"  --host 127.0.0.1  --port 8081  -ngl 99 -fa -c 4096 -b 512
```

The LLM only needs to be reachable from localhost since the Nuxt server calls it server-side.

#### 4. Access from your other devices

After Tailscale is running, find your machine's Tailscale IP:

```bash
tailscale ip -4
# Example output: 100.64.1.42
```

From any device on your tailnet, open:

```
http://100.64.1.42:3000
```

Or use the MagicDNS hostname (shown in the Tailscale admin console), e.g.:

```
http://your-pc.tail12345.ts.net:3000
```

#### 5. (Optional) Enable HTTPS with Tailscale

Tailscale can provision real Let's Encrypt TLS certs for your MagicDNS hostnames:

```bash
tailscale cert your-pc.tail12345.ts.net
```

This gives you `your-pc.tail12345.ts.net.crt` and `.key` files. You can put Caddy or nginx in front of the Nuxt server to serve HTTPS, or just use HTTP since Tailscale already encrypts all traffic with WireGuard anyway.

#### 6. (Optional) Run as a system service

To keep the app running after you close the terminal:

**Linux (systemd):**

```ini
# /etc/systemd/system/recipe-app.service
[Unit]
Description=Recipe App
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/RecipeApp
ExecStart=/usr/bin/node .output/server/index.mjs
Environment=HOST=0.0.0.0
Environment=PORT=3000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now recipe-app
```

**Windows (Task Scheduler or NSSM):**

```powershell
# Using NSSM (Non-Sucking Service Manager) — https://nssm.cc
nssm install RecipeApp "C:\Program Files\nodejs\node.exe" "C:\Users\evanr\code\RecipeApp\.output\server\index.mjs"
nssm set RecipeApp AppDirectory "C:\Users\evanr\code\RecipeApp"
nssm set RecipeApp AppEnvironmentExtra HOST=0.0.0.0 PORT=3000
nssm start RecipeApp
```

#### 7. Lock it down further (optional)

Tailscale ACLs let you control which devices can reach which ports. In the Tailscale admin console (Access Controls), you can add:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["autogroup:member"],
      "dst": ["autogroup:self:3000"]
    }
  ]
}
```

This ensures only *your* authenticated devices can reach port 3000, even within your tailnet.

---

## Quick comparison

| | Railway | Local + Tailscale |
|---|---|---|
| LLM support | CPU only (slow) or swap to cloud API | Full GPU |
| SQLite | Needs volume, ephemeral risk | Native filesystem |
| Access control | Basic auth / Cloudflare Access | Tailscale ACLs (built-in) |
| Monthly cost | ~$5-20+ | Free (Tailscale free tier) |
| Accessible when PC is off | Yes | No (need a home server or always-on PC) |
| Setup complexity | Medium | Low |
