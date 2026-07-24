# lifesum-sync

MCP server (Streamable HTTP transport) exposing your Lifesum nutrition data.

## How it works

Lifesum's web export (`lifesum.com/account/export-data`) hits
`https://api.lifesum.com/food-tracker/v1/export/week/{date}`, returning a CSV of
logged food entries for the 7 days ending on `{date}`, authenticated with a
JWT Bearer token. There's no public login API (the web app signs in via Google),
so the token has to be lifted from a real browser session and refreshed manually
every ~48h (the token's lifetime). Use the `register_lifesum_token` tool to hand
the server a fresh token — it's validated and persisted to `data/token.json`.

## Setup

```bash
npm install
cp .env.example .env
```

### Run the MCP server

Streamable HTTP (default, `npm start` / `node index.js`):

```bash
npm run mcp:http
```

Listens on `http://127.0.0.1:3000/mcp` (configurable, see below). Add it to an
MCP client that supports Streamable HTTP:

```json
{
  "mcpServers": {
    "lifesum-sync": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

Stdio transport is also available for clients that need it (e.g. Claude Desktop):

```bash
npm run mcp:stdio
```

```json
{
  "mcpServers": {
    "lifesum-sync": {
      "command": "node",
      "args": ["/absolute/path/to/lifesum-sync/src/stdioServer.js"]
    }
  }
}
```

### Environment variables

| Variable          | Default     | Description                                                        |
| ------------------ | ----------- | -------------------------------------------------------------------- |
| `PORT`              | `3000`      | HTTP port for the streamable-http server.                             |
| `HOST`              | `127.0.0.1` | Bind address. Set to `0.0.0.0` in Docker.                             |
| `MCP_AUTH_TOKEN`    | _(unset)_   | If set, `/mcp` requires `Authorization: Bearer <value>`.              |
| `MCP_ALLOWED_HOSTS`  | _(unset)_   | Comma-separated `Host` header allowlist (only relevant off-localhost). |
| `LIFESUM_TOKEN`     | _(unset)_   | Optional bootstrap token, used only if none has been registered yet.  |
| `DATA_DIR`          | `data`      | Where the registered token and CSV downloads are stored.             |

### Register a token

Either call the `register_lifesum_token` tool from your MCP client, or set
`LIFESUM_TOKEN` in `.env` as a one-time bootstrap value:

1. Log in to https://lifesum.com in a browser (Google login is fine).
2. Open DevTools → Network tab, go to the export page and trigger an export
   (or just reload a page that fetches diary data).
3. Find a request to `api.lifesum.com/food-tracker/v1/export/week/...`.
4. Copy the `Authorization: Bearer <token>` header value (just the token part).
5. Call `register_lifesum_token({ token })`, or put it in `.env` as `LIFESUM_TOKEN`.

The token is a JWT valid for 48h. When it expires, tool calls return an error
telling you to repeat these steps.

## Docker

Build locally:

```bash
docker compose up --build
```

Or pull the image CI publishes (see below) and just run it:

```bash
docker compose pull
docker compose up
```

Either way this binds the server to `0.0.0.0:3000` and persists `data/`
(including the registered token) in a named volume. Set `MCP_AUTH_TOKEN` in
your shell or a `.env` file before starting it if you're exposing the port
beyond localhost.

Without compose:

```bash
docker build -t lifesum-mcp .
docker run -p 3000:3000 -v lifesum-data:/app/data -e MCP_AUTH_TOKEN=secret lifesum-mcp
```

## CI/CD

`.github/workflows/docker-publish.yml` runs on every push and PR:

1. **`secret-scan`** — runs [gitleaks](https://github.com/gitleaks/gitleaks) over the repo history on every push/PR.
2. **`build`** — builds the Docker image (no push) on every push and PR, including from forks, to catch breakage early.
3. **`publish`** — logs in to Docker Hub and pushes `zwisler/lifesum-mcp`, tagged `latest` (on `main`), `<semver>` (on `vX.Y.Z` tags), and the short commit SHA. This job is gated on `github.event_name == 'push'` **and** `github.repository == 'zwisler/lifesum-sync'`, so pull requests — including from forks — never reach the login step or touch the registry secrets.

To enable publishing, add these repository secrets (Settings → Secrets and variables → Actions):

| Secret               | Value                                                              |
| --------------------- | ------------------------------------------------------------------- |
| `DOCKERHUB_USERNAME` | Your Docker Hub username.                                            |
| `DOCKERHUB_TOKEN`    | A Docker Hub **access token** (Account Settings → Security), not your password. Scope it to this repo only. |

Both are consumed only inside the `publish` job's `docker/login-action` step
and are never echoed to logs (GitHub Actions automatically masks secret
values in step output).

## CLI usage

Download a week's CSV to `data/` directly, without the MCP server:

```bash
npm run download            # today's 7-day window
npm run download 2026-07-17 # window ending 2026-07-17
```

## Tools

- `get_nutrition_week(date?)` — logged entries + per-day macro totals for the
  7-day window ending on `date` (defaults to today).
- `register_lifesum_token(token)` — validates and persists a new Bearer token.
- `lifesum_token_status()` — reports whether a token is registered and its
  expiry status.
