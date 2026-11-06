# Ajaia Docs

A lightweight collaborative document editor: create and format documents, import files, and share them with other users as editors or viewers.

- **Live app:** _LIVE_URL_ (see `SUBMISSION.md`)
- **Stack:** Next.js 15 (App Router) + TypeScript, TipTap editor, Postgres via Drizzle ORM, Vitest. Deployed on Vercel with a free Neon Postgres database.

## Demo accounts

Sign-in is mocked: choose an account on the sign-in screen, with no password. Use **Switch user** in the top bar to change accounts.

| Account | Email | Seeded data |
| --- | --- | --- |
| Alice Chen | alice@ajaia.test | Owns "Q4 planning" (shared with Bob as an editor) |
| Bob Martinez | bob@ajaia.test | Owns "Team handbook" (shared with Alice as a viewer) |
| Carol Singh | carol@ajaia.test | Nothing yet, so you can test sharing from scratch |

**A 2-minute review path**
1. Sign in as Alice. "My documents" and "Shared with me" are listed separately, and each document has an Owner, Can edit or Can view badge.
2. Click **New document**, rename it in the title field, and type with formatting (headings, bold, italic, underline, lists). Reload the page: the content and formatting persist.
3. Click **Share**, and add `carol@ajaia.test` as **Can view**.
4. Click **Switch user**, then choose Carol. The document is under "Shared with me", and opening it shows a read-only view with no toolbar.
5. Back as Alice, click **Import file**, then upload a `.md`, `.txt` or `.docx` file. It opens as a new editable document. Sample files are in `samples/`.

## Features

| Area | What works |
| --- | --- |
| Editing | Create, rename, edit, autosave (about 0.8 s after typing stops), with save status in the header. Ctrl/Cmd+S saves immediately. Formatting: H1–H3, bold, italic, underline, bulleted and numbered lists, undo and redo. |
| File upload | Import a **.txt, .md or .docx file (max 5 MB)** as a new document. Formatting is kept where the editor supports it, and unsupported or unsafe markup (scripts, images, tables) is dropped. Other file types are rejected with a clear message. |
| Sharing | Each document has one owner. The owner shares by email as **editor** or **viewer**, can change a role, and can remove access. Editors can edit and rename. Only the owner can share or delete. |
| Persistence | Postgres. Content is stored as TipTap JSON, so formatting round-trips exactly. |
| Concurrent saves | Each save carries the version it was based on. If someone else saved first, the server rejects the save (HTTP 409) instead of overwriting their work, and the UI asks you to reload. |

## Run locally

Requirements: Node 20+ and a Postgres database (local, Docker, or a free Neon project).

```bash
npm install
cp .env.example .env.local      # then set DATABASE_URL and SESSION_SECRET
npm run db:setup                 # applies migrations and seeds the demo accounts (safe to re-run)
npm run dev                      # http://localhost:3000
```

Postgres with Docker, if you don't have one running:

```bash
docker run -d --name ajaia-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
```

## Tests

```bash
npm test                                                   # unit tests (no database needed)
TEST_DATABASE_URL=postgres://... npm test                  # also runs the Postgres integration tests
```

- `tests/access.test.ts`: the full permission matrix (owner, editor, viewer, no access) for read, edit, rename, share and delete.
- `tests/import.test.ts`: .md, .txt and .docx conversion; unsafe markup is stripped; bad, empty and oversized files are rejected; content validation.
- `tests/sharing.integration.test.ts`: the real data layer against Postgres. Covers shared-with-me listings, role enforcement, role upgrades, stale-save conflicts, and revoking access. **Note:** it truncates the tables in the database you point it at, so use a separate test database.

## Deploy (Vercel + Neon, both free)

1. Create a Neon project and copy the **pooled** connection string (it ends with `?sslmode=require`).
2. Import the repo in Vercel. Set the environment variables `DATABASE_URL` (the Neon string) and `SESSION_SECRET` (any random string of 32+ characters).
3. Deploy. Vercel runs the `vercel-build` script, which applies migrations, seeds the demo accounts, and then builds the app.

## Project layout

```
src/app/            pages (sign-in, dashboard, editor) and API routes under src/app/api
src/components/     DocEditor (autosave and conflicts), Toolbar, ShareDialog, Dashboard
src/lib/access.ts   permission rules, used by every API route
src/lib/documents.ts data access; every function checks permissions first
src/lib/import.ts   file to document conversion
src/lib/content.ts  document validation against the editor schema
src/db/             Drizzle schema and client; migrations are in drizzle/
scripts/db-setup.ts migrations and idempotent seed
```

See `ARCHITECTURE.md` for decisions and tradeoffs, and `AI_WORKFLOW.md` for how AI was used.
