"use client";

import { useEffect, useRef, useState } from "react";
import { api, initials } from "@/lib/api-client";

type Role = "editor" | "viewer";
type Person = { userId: string; name: string; email: string; role: Role };
type U = { id: string; name: string; email: string };

export function ShareDialog({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [directory, setDirectory] = useState<U[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    api<{ shares: Person[] }>(`/api/documents/${docId}/shares`)
      .then((r) => setPeople(r.shares))
      .catch((e) => setError(e.message));
    api<{ users: U[] }>("/api/users")
      .then((r) => setDirectory(r.users))
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docId, onClose]);

  async function share(targetEmail: string, targetRole: Role) {
    setPending(true);
    setError(null);
    try {
      const added = await api<Person>(`/api/documents/${docId}/shares`, {
        method: "POST",
        body: JSON.stringify({ email: targetEmail, role: targetRole }),
      });
      setPeople((prev) => {
        const rest = (prev ?? []).filter((p) => p.userId !== added.userId);
        return [...rest, added].sort((a, b) => a.name.localeCompare(b.name));
      });
      setEmail("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(p: Person) {
    setError(null);
    try {
      await api(`/api/documents/${docId}/shares/${p.userId}`, { method: "DELETE" });
      setPeople((prev) => (prev ?? []).filter((x) => x.userId !== p.userId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share document</h2>
        <p className="sub">People you add will see it under &ldquo;Shared with me&rdquo;.</p>
        <form
          className="field-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) share(email.trim(), role);
          }}
        >
          <input
            ref={inputRef}
            className="input"
            type="email"
            placeholder="Email address"
            aria-label="Email address"
            list="share-directory"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select className="select" aria-label="Access level" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="btn btn-primary" disabled={pending || !email.trim()}>
            {pending ? "Sharing…" : "Share"}
          </button>
          <datalist id="share-directory">
            {directory.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name}
              </option>
            ))}
          </datalist>
        </form>
        <p className="helper">Demo accounts: {directory.map((u) => u.email).join(", ")}</p>
        {error && <p className="form-error" role="alert">{error}</p>}

        <ul className="people" aria-label="People with access">
          {people === null ? (
            <li className="person doc-meta">Loading…</li>
          ) : people.length === 0 ? (
            <li className="person doc-meta">Only you have access.</li>
          ) : (
            people.map((p) => (
              <li key={p.userId} className="person">
                <span className="avatar" aria-hidden>
                  {initials(p.name)}
                </span>
                <span className="person-main">
                  <span className="person-name">{p.name}</span>
                  <br />
                  <span className="person-email">{p.email}</span>
                </span>
                <select
                  className="select"
                  aria-label={`Access for ${p.name}`}
                  value={p.role}
                  onChange={(e) => share(p.email, e.target.value as Role)}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button className="btn btn-ghost btn-danger" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
