# Southbag Office™

Docs, Slides, and Sheets in one deliberately disorienting Southbag workspace. Files save immediately to the browser and synchronize to a Cloudflare D1 workspace in the background. Signed-in workspaces are keyed to Southbag Identity; signed-out visitors receive an isolated HttpOnly guest workspace.

## Local development

```sh
bun install
cp .env.example .env
bun run db:migrate:local
bun run dev
```

The editors and local D1 cloud sync work without signing in. To exercise SSO, create a confidential OAuth app at `https://identity.southbag.cc/developer/apps/new` with this callback:

```text
http://localhost:5173/auth/callback
```

Then set `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and a long random `SESSION_SECRET` in `.env`.

## Checks

```sh
bun run check
bun run test
bun run test:e2e
bun run build
```

## Cloudflare deployment

Authenticate Wrangler, create the production D1 database, and replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID:

```sh
bunx wrangler login
bun run cf:db:create
bun run db:migrate:remote
```

Register the production callback URL `https://office.southbag.cc/auth/callback` in Southbag Identity. Set Worker secrets without putting them in `wrangler.jsonc`:

```sh
bunx wrangler secret put OIDC_CLIENT_ID
bunx wrangler secret put OIDC_CLIENT_SECRET
bunx wrangler secret put SESSION_SECRET
bun run build
bun run cf:deploy
```

The included Worker route claims `office.southbag.cc` as a custom domain. Remove the `routes` entry if the domain is managed separately in the Cloudflare dashboard. The zero UUID in the checked-in configuration is intentionally local-only and must be replaced before production deployment.

`ORIGIN` and `IDENTITY_ORIGIN` are non-secret Worker vars. OAuth code exchange and user-info lookup happen only on the Worker, so the Identity provider does not need to allow browser CORS for Office.
