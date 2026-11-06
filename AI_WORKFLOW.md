# AI workflow note

> **Draft. Manas: rewrite this in your own words before submitting.** The facts below are accurate for the build session. The "My review" section is yours to fill in with what you actually checked, changed or pushed back on.

## Tools used

- **Claude (Opus 5.5, in the Claude app with a code workspace)** as a pair programmer. It scaffolded the app, wrote most of the first-pass code, ran the tests and a headless-browser walkthrough, and drafted these notes. I set the scope, chose the stack and sharing model, and reviewed each stage.

## Where AI materially sped things up

- **Scaffolding and boilerplate:** the Next.js setup, Drizzle schema and migrations, API routes with validation, and the seed script took minutes instead of an hour.
- **Library details:** TipTap v3 APIs (`useEditorState`, server-side `generateJSON`), mammoth for .docx, and Drizzle's conditional updates.
- **Verification at scale:** a curl smoke test of every permission and error path, plus a scripted headless-Chrome run through create, format, reload, share, view as another user, import, and a two-user save conflict, with screenshots checked after each UI change.

## AI output that was changed or rejected

These happened during the session:

- **ORM swap.** The first plan used Prisma. Its engine binaries couldn't be downloaded in the build environment, and Prisma also adds cold-start weight on serverless. Switched to Drizzle (pure JavaScript, plain SQL migrations).
- **Autosave retry logic.** The first version of the editor's save loop read stale React state when deciding whether to retry, so it could retry forever after a server error. Rewritten so that it only auto-saves again after a *successful* save that had more edits queued. After a failure it waits for a manual retry or the next edit.
- **Conflict test that passed for the wrong reason.** The first smoke test of "stale save is rejected" sent an empty document, which failed schema validation, not the version check. Caught by reading the response, then re-tested with valid content to confirm the real 409.
- **Editor locking on conflict.** After a conflict the editor originally stayed editable, so a user could keep typing text that would never save. It now locks until reload.
- **UI fixes from screenshot review:** the toolbar wasn't aligned with the page, the "Text" button lit up inside lists, the topbar didn't fit on mobile, and the import hint copy was awkward.
- **Fonts.** The default `next/font/google` setup fetches fonts at build time, and the build environment blocked that. Switched to self-hosted `@fontsource` packages, which also removes a runtime dependency on Google.

## How correctness, UX and reliability were verified

- **Automated tests (44):** the permission matrix, file import (including script stripping and rejection of bad, empty and oversized files), schema validation, and Postgres integration tests for sharing, role changes, revoking access, and stale-save conflicts.
- **End-to-end checks:** curl against a production build for auth (including a forged cookie), every role boundary, validation errors, and import. Headless Chrome for the full user flows on desktop and mobile widths, with zero console errors.
- **Not taking AI output at face value:** every test was read for *what* it asserts, not just whether it passes (see the conflict-test example above).

## My review (Manas, fill in)

- _What did you read closely or change yourself?_
- _Any decision where you overrode the AI's suggestion?_
- _What did you test by hand on the live deployment?_
