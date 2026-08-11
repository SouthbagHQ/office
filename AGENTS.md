# Southbag Office agent guide

This file applies to the entire repository. Treat the current code and migrations as the source of truth when older prose disagrees with them.

## Product contract

Southbag Office is one SvelteKit application containing lightweight Docs, Slides, and Sheets editors. It intentionally looks and reads like a slightly disorienting office suite. Preserve its odd labels, mismatched-looking controls, animated ambient chrome, and visual character unless a task explicitly changes the product direction.

The following behavior is deliberate and should not regress:

- Authentication is mandatory. Signed-out users are redirected to `/login`, and workspace and file APIs return `401`. Do not reintroduce guest workspaces; migration `0002_remove_guest_workspaces.sql` removes them.
- Work is saved locally first and then synchronized to a per-user Cloudflare D1 workspace.
- Documents, slides, and sheets can only be imported or exported through the server-encrypted Southbag formats.
- Copy, cut, and drag-based content egress are blocked at the application window. Paste remains allowed, including sanitized rich-text paste into Docs.
- Use `AppDialog.svelte` for confirmations and notices. Avoid native `alert`, `confirm`, or `prompt` dialogs.
- Southbag logo images and dialog backdrops are intentionally static. Other ambient application animation is intentional.
- Keep accessibility names, semantic roles, keyboard behavior, and the narrow/mobile layout working even when the visible product copy is intentionally strange.

## Stack and runtime

- Package manager/runtime: Bun. Use `bun install` and `bun run ...`; do not introduce npm- or pnpm-specific lockfiles.
- Framework: SvelteKit 2 with Svelte 5 and strict TypeScript.
- Deployment target: Cloudflare Workers via `@sveltejs/adapter-cloudflare`.
- Persistence: Cloudflare D1, exposed to server code as the `DB` platform binding.
- Notable libraries: `jose` for OIDC verification, `sanitize-html` for server-side document sanitization, and `fflate` for Southbag packages.
- Worker-facing code must remain compatible with the Workers runtime. `nodejs_compat` is enabled, but prefer Web APIs already used by the codebase (`crypto.subtle`, `Request`, `Response`, streams, `TextEncoder`, and `TextDecoder`).

The Svelte code currently uses both legacy component syntax (`export let`, `$:`) and newer runes syntax in a few framework files. Match the file being edited rather than mechanically converting unrelated components.

## Local setup and commands

```sh
bun install
cp .env.example .env
bun run db:migrate:local
bun run dev
```

Useful commands:

```sh
bun run check              # SvelteKit sync + svelte-check
bun run build              # production Cloudflare build
bun run preview            # preview a production build
bun run db:migrate:local
bun run db:migrate:remote
bun run cf:db:create
bun run cf:deploy
```

The normal development server binds to localhost. Only use `bun run dev --host 0.0.0.0` when public/network access was explicitly requested; a Vite development server is not a production deployment.

## Environment variables

Use `.env.example` as the public template. `.env` and `.env.*` are ignored except for `.env.example`; never commit or print real secrets.

- `OIDC_CLIENT_ID`: production Southbag Identity confidential-client ID. Leave empty in local development to select the built-in identity provider.
- `OIDC_CLIENT_SECRET`: matching confidential-client secret. Leave empty with the local provider.
- `SESSION_SECRET`: long random secret used to HMAC-sign eight-hour session cookies. Set it locally even though development has a fallback.
- `SOUTHBAG_FILE_KEY`: base64 encoding of exactly 32 random bytes, used only on the server for AES-GCM import/export encryption. Generate with `openssl rand -base64 32`.
- `ORIGIN`: canonical application origin, normally `http://localhost:5173` locally and `https://office.southbag.cc` in production.
- `IDENTITY_ORIGIN`: Southbag Identity origin, normally `https://identity.southbag.cc`.

Never expose `SESSION_SECRET`, `OIDC_CLIENT_SECRET`, or `SOUTHBAG_FILE_KEY` through client modules, public environment variables, logs, responses, fixtures, or committed files. Keep the same production `SOUTHBAG_FILE_KEY` across deployments that need to open earlier exports; rotating it makes those packages unreadable.

When OIDC credentials are absent during `vite dev`, the built-in provider is used. Its development password is `southbag`, and the login screen supplies the example account. The `/dev-idp/**` routes must stay development-only and return `404` in production.

## Repository map

- `src/routes/+page.svelte`: application shell, local persistence, cloud-save queue, conflict handling, import/export orchestration, and editor routing.
- `src/lib/components/Home.svelte`: file list, creation, import/export entry points, and deletion menus.
- `src/lib/components/Docs.svelte`: rich-text document editor and sanitized paste/drop handling.
- `src/lib/components/Slides.svelte`: presentation editor, layouts, themes, notes, and presentation mode.
- `src/lib/components/Sheets.svelte`: spreadsheet UI and formula-bar integration.
- `src/lib/components/AppDialog.svelte`: application-owned modal dialog.
- `src/lib/workspace.ts`: canonical discriminated file/workspace types and file creation.
- `src/lib/cloud.ts`: client-side revision-conflict merge logic.
- `src/lib/sheet.ts`: small spreadsheet expression engine.
- `src/lib/document-html.ts`: browser-side rich-text sanitizer.
- `src/lib/file-format.ts`: public file extensions, MIME types, and safe filenames.
- `src/lib/server/workspace.ts`: authoritative workspace validation, size limits, ownership, and server-side document sanitization.
- `src/lib/server/document-html.ts`: authoritative HTML sanitizer using `sanitize-html`.
- `src/lib/server/file-format.ts`: encrypted package codec.
- `src/lib/server/request.ts`: bounded streaming request-body reader.
- `src/lib/server/session.ts`: signed session cookie codec and cookie helpers.
- `src/lib/server/dev-idp.ts` and `src/routes/dev-idp/**`: development OIDC provider.
- `src/routes/auth/**`: OIDC login, callback, and logout.
- `src/routes/api/workspace/+server.ts`: authenticated D1 workspace API with optimistic revisions.
- `src/routes/api/files/**`: authenticated encrypted import/export APIs.
- `src/hooks.server.ts`: session hydration, security headers, and private cache policy.
- `migrations/`: ordered D1 schema/data migrations. Add a new numbered migration for deployed schema changes; do not rewrite an existing migration.
- `wrangler.jsonc`: Worker, assets, custom-domain, environment-var, and D1 binding configuration.

## Workspace persistence and conflict rules

`Workspace` contains `files` plus optional `deletedIds` tombstones. `OfficeFile` is a discriminated union keyed by `kind`: `doc`, `slides`, or `sheet`.

The browser stores a separate local workspace, revision, update timestamp, and dirty flag under a key containing the authenticated user's `sub`. A change is written to `localStorage` immediately and queued for cloud save after roughly 700 ms. Page hide and restoration of network access attempt to flush pending work.

D1 rows are keyed by `user:<sub>`. PUT requests include `expectedRevision`. A stale revision returns `409` with the current cloud workspace; the client merges and retries. Merge behavior is part of the data contract:

- Unique file IDs from both sides survive.
- For a shared file ID, the newest `modified` timestamp wins.
- Tombstones from either side are unioned and always beat a matching file. This prevents an older tab from resurrecting deleted content.
- Merged files remain sorted newest-first.

Always update a file's `modified` timestamp when its meaningful content changes. Generate new IDs with `newOfficeFileId`; its fallback must continue to work on insecure HTTP origins where `crypto.randomUUID` may be unavailable.

The server, not client TypeScript types, is the trust boundary. `parseWorkspace` validates shapes and sizes and sanitizes document HTML before storage or export. Preserve its current bounds unless a task intentionally revises the format: at most 250 files, at most 1,000 tombstones, and about 2 MB of serialized workspace data.

## Authentication contract

Production authentication is authorization-code OIDC with S256 PKCE, state, nonce, signed ID-token verification through provider metadata/JWKS, and a server-side user-info lookup. OAuth transaction cookies are short-lived, HttpOnly, SameSite=Lax cookies. The resulting `southbag_office_session` cookie is HMAC-signed, HttpOnly, SameSite=Lax, secure on HTTPS, and expires after eight hours.

Preserve state, verifier, nonce, issuer, audience, subject, and user-info subject checks. Do not weaken token verification or trust profile fields directly from query parameters or unverified JWT contents. The token endpoint request currently sends a same-origin `Origin` header because the production Identity service's SvelteKit CSRF protection requires it.

## Encrypted Southbag file contract

Extensions and MIME types are kind-specific:

| Kind | Extension | MIME type |
| --- | --- | --- |
| Docs | `.southbagdocs` | `application/vnd.southbag.docs` |
| Slides | `.southbagslides` | `application/vnd.southbag.slides` |
| Sheets | `.southbagsheets` | `application/vnd.southbag.sheets` |

Exports are validated and sanitized server-side, zipped as `manifest.json` plus `content.json`, then encrypted with AES-256-GCM. The binary header contains the `SOUTHBAG` magic value, format version, kind code, and 12-byte IV; the magic/version/kind bytes are authenticated as additional data. Imports verify the size, header, version, kind, authentication tag, archive entries, manifest, and content before returning an `OfficeFile`.

Do not move encryption to the browser, return plaintext packages, silently accept another kind/extension, or include the key in the package. Preserve private/no-store and `nosniff` download headers. Current limits are approximately 2.1 MB for export request bodies, 2.6 MB for import requests, and 2.5 MB for encrypted packages.

## Security invariants

- Every editor page and workspace/file API operation requires `locals.user`.
- `hooks.server.ts` sets `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, same-origin resource policy, no-referrer, `nosniff`, and frame denial headers. Authenticated responses and the workspace API are private/no-store.
- Keep both HTML sanitizers aligned. Browser sanitization protects the editor and handles paste/drop; server sanitization is authoritative for stored and exported data.
- Allowed document markup is intentionally small. Only safe formatting tags, text alignment, safe HTTP(S)/mailto links, and safe image sources are retained. Event handlers, executable elements, unsafe schemes, arbitrary styles, SVG, MathML, iframes, and embedded objects must not pass through.
- Keep bounded streamed body reads for import/export. Checking only `Content-Length` is insufficient because it can be missing or false.
- The global copy/cut/drag prevention is intentional. Do not accidentally block paste, typing, or editing while maintaining it.
- Do not loosen workspace limits or package validation without targeted validation.

## Change and validation expectations

Keep changes scoped and follow existing strict TypeScript and Svelte patterns. Prefer canonical types from `src/lib/workspace.ts`, `$lib` imports, immutable file/workspace updates, and Web APIs. Avoid new dependencies unless the existing stack cannot reasonably solve the task.

For most changes, run:

```sh
bun run check
bun run build
```

## Cloudflare deployment notes

`wrangler.jsonc` intentionally contains a zero UUID for the D1 database. Before a real deployment, create the database, replace that placeholder with the returned ID, apply remote migrations, and configure the four secrets with `wrangler secret put`. Do not commit production secrets to Wrangler configuration.

The production callback is `https://office.southbag.cc/auth/callback`; local production-SSO testing uses `http://localhost:5173/auth/callback`. The checked-in Worker route claims `office.southbag.cc` as a custom domain. Coordinate changes to the route with however the domain is managed rather than deploying a competing route accidentally.
