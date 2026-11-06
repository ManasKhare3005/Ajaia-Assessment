# Architecture note

## What I prioritized and why

The brief asks for depth in a few areas instead of breadth. I put the depth where a shared-document product breaks first in real use:

1. **Access control that can't be bypassed.** All permission rules live in one pure module (`src/lib/access.ts`). Every data function in `src/lib/documents.ts` calls it before reading or writing. API routes never check roles themselves. Because the rules are pure functions, the whole permission matrix is unit-tested. Users with no access get a 404 instead of a 403, so the app doesn't reveal that a document exists.
2. **Not losing people's work.** Autosave plus optimistic concurrency. Each document has a `version`, and a save is a conditional `UPDATE … WHERE version = baseVersion`. If someone else saved first, the server returns 409, and the editor locks and asks the user to reload instead of silently overwriting the other person. Renames don't bump the version, so they never cause conflicts.
3. **Formatting that survives.** Documents are stored as TipTap (ProseMirror) JSON, not HTML. The server validates every save against the same editor schema the browser uses, so a broken or hand-crafted request can't store a document the editor can't open. One shared extension list in `src/lib/editor-extensions.ts` guarantees the browser and server agree.
4. **A file import that's useful and safe.** `.md`, `.txt` and `.docx` are each converted to HTML and then parsed through the editor schema. Anything the editor doesn't support, including scripts and event handlers, is dropped by construction instead of by a hand-written sanitizer.

## Key decisions

| Decision | Why | Tradeoff |
| --- | --- | --- |
| Next.js (one app for the UI and the API) | One deploy, one language, server components load data without a client fetch | API routes are tied to Next. Fine at this scope. |
| TipTap | Mature ProseMirror wrapper, schema-based, works on the server for import and validation | Adds about 130 kB to the editor page |
| Postgres (Neon) + Drizzle | Real relational data for shares. Free hosted tier, so reviewers pay nothing. Drizzle is pure JavaScript with SQL migrations and no binary engine. | SQLite would be simpler locally, but Vercel's filesystem isn't persistent |
| Mock auth with an HMAC-signed, httpOnly cookie | The brief allows seeded users. Signing the cookie means a user id can't be forged by editing it. | No passwords or real identity. Swapping in a real identity provider only changes `src/lib/session.ts`. |
| Owner + editor/viewer roles | One step beyond basic access (an optional stretch item), and it exercises the permission design | No commenter role, no link sharing |
| Import creates a new document | The clearest product flow ("bring my existing doc in") | No attachments or importing into an existing draft |

## Data model

```
users(id, email unique, name)
documents(id, title, content jsonb, owner_id → users, version, created_at, updated_at)
shares(document_id → documents, user_id → users, role editor|viewer)   PK(document_id, user_id)
```

Deleting a document cascades to its shares. Re-sharing with the same person updates their role instead of adding a duplicate.

## Deliberately left out

- **Real-time co-editing (CRDT/Yjs) and presence.** This is the largest piece of a real Google Docs, and it can't be done well in the timebox. The version check gives correctness (no silent overwrites) without it.
- **Real authentication**, password reset and organizations.
- **Comments, suggestion mode, version history, export.**
- **Images, tables and links in the toolbar.** Links pasted in are kept by the editor.
- **Search and pagination of the document list.** The user directory is listed openly for the demo. A real product would search users instead.

## What I'd build next (2–4 hours)

1. Version history: store a snapshot on each save (or every N minutes) and allow restoring one. This is cheap because content is already JSON with a version number.
2. Live updates without full CRDTs: poll or use server-sent events to tell an open editor "Bob just saved", which avoids most conflicts in the first place.
3. Export to Markdown or PDF, reusing the same schema on the server.
4. Playwright end-to-end tests in CI covering the sharing flow (the flows were checked manually in a headless browser during development).
