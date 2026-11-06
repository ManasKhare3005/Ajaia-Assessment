# Submission: Full Stack Product Engineer assessment

**Candidate:** Manas Khare

## Links

- **Live app:** _LIVE_URL_
- **Walkthrough video:** see `VIDEO_URL.txt`
- **Source:** this folder (also on GitHub: _REPO_URL_)

## Test accounts

Mock sign-in with no passwords. Choose an account on the sign-in screen, and use **Switch user** to change.

- `alice@ajaia.test`: owns "Q4 planning", shared with Bob as an editor
- `bob@ajaia.test`: owns "Team handbook", shared with Alice as a viewer
- `carol@ajaia.test`: starts empty; use her to test sharing from scratch

## What's included

| File / folder | Contents |
| --- | --- |
| `README.md` | Features, demo accounts, local setup, tests, deployment |
| `ARCHITECTURE.md` | What I prioritized, key decisions and tradeoffs, data model, what's next |
| `AI_WORKFLOW.md` | AI tools used, where they helped, what was changed or rejected, how it was verified |
| `SUBMISSION.md` | This file |
| `VIDEO_URL.txt` | Walkthrough video link |
| `screenshots/` | Dashboard, editor, share dialog, viewer mode, import, conflict handling, mobile |
| `samples/` | Sample .md, .txt and .docx files for testing import |
| `src/`, `tests/`, `drizzle/`, `scripts/` | Source code, tests, SQL migrations, migration and seed script |

## Status

**Working end to end:** create, rename, edit with formatting, autosave and reopen; import .txt, .md and .docx; share as editor or viewer, change roles, revoke access; owned and shared lists; read-only viewer mode; stale-save conflict detection; validation and error messages; 44 automated tests.

**Not built (deliberate scope cuts, see ARCHITECTURE.md):** real-time co-editing and presence, real authentication, comments, version history, export.

**Next 2–4 hours:** version history with restore, "someone else just saved" live notices, Markdown/PDF export, Playwright end-to-end tests in CI.
