# Southbag Office™

Docs, Slides, and Sheets in one deliberately disorienting Southbag workspace. Files save immediately to the browser and synchronize in the background to [Southbag Drive™](https://github.com/SouthbagHQ/drive). Each document is an encrypted `.southbagdocs` / `.southbagslides` / `.southbagsheets` file in your Drive, where it counts toward your 71.1 floppy disks. Drive can download, share, or **Open in Office™** any of them. Workspaces are keyed to Southbag Identity.

Office talks to Drive over a Cloudflare **service binding** (`DRIVE` → `southbag-drive`'s `OfficeStorage` RPC entrypoint), never over the public internet. Drive only ever stores ciphertext; `SOUTHBAG_FILE_KEY` stays in Office.

## Local development

```sh
bun install
cp .env.example .env
bun run db:migrate:local
bun run dev
```

Workspace sync needs Southbag Drive running locally. In a Drive checkout, run `bun run db:migrate:local && bun run build && bunx wrangler dev` (port 8787). Office's `DRIVE` binding finds it through Wrangler's dev registry. Without it, the workspace API returns `503`.

Authentication is mandatory for both the editors and workspace API. On first login, Office dynamically registers a public PKCE client with Southbag Identity and stores its client ID in D1 for later logins.

Development credentials are shown on its login page:

```text
employee@southbag.cc / southbag
```

Set a long random `SESSION_SECRET` in `.env`. The built-in provider remains available during development with `USE_DEV_IDP=true`; its routes return 404 in production builds.

Southbag file import and export also requires a server-only 256-bit key. Generate it once and keep the same value for every deployment that must open existing exports:

```sh
openssl rand -base64 32
```

Put the result in `SOUTHBAG_FILE_KEY` in `.env`. The browser never receives the key. Docs, Slides, and Sheets use `.southbagdocs`, `.southbagslides`, and `.southbagsheets` respectively.

## Checks

```sh
bun run check
bun run build
```

## Cloudflare deployment

Authenticate Wrangler, create the production D1 database, and replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID:

```sh
bunx wrangler login
bun run cf:db:create
bun run db:migrate:remote
```

Deploy Southbag Drive first, including its migrations. Office's `DRIVE` binding requires the `southbag-drive` Worker to export `OfficeStorage`.

Set Worker secrets without putting them in `wrangler.jsonc`:

```sh
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put SOUTHBAG_FILE_KEY
bun run build
bun run cf:deploy
```

The included Worker route claims `office.southbag.cc` as a custom domain. Remove the `routes` entry if the domain is managed separately in the Cloudflare dashboard. The zero UUID in the checked-in configuration is intentionally local-only and must be replaced before production deployment.

`ORIGIN` and `IDENTITY_ORIGIN` are non-secret Worker vars. OAuth code exchange and user-info lookup happen only on the Worker, so the Identity provider does not need to allow browser CORS for Office.
