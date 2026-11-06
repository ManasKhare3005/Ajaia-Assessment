"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, initials } from "@/lib/api-client";

type U = { id: string; name: string; email: string };

export function SignInList({ users, label }: { users: U[]; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(id: string) {
    setPending(id);
    setError(null);
    try {
      await api("/api/session", { method: "POST", body: JSON.stringify({ userId: id }) });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    }
  }

  if (users.length === 0) {
    return <p className="alert">No demo accounts found. Run <code>npm run db:setup</code> to seed them.</p>;
  }

  return (
    <section className="signin-group" aria-label={label}>
      <h2 className="signin-label">{label}</h2>
      <ul className="signin-list">
        {users.map((u) => (
          <li key={u.id}>
            <button className="signin-btn" onClick={() => signIn(u.id)} disabled={pending !== null}>
              <span className="avatar" aria-hidden>
                {initials(u.name)}
              </span>
              <span>
                <strong>{u.name}</strong>
                <br />
                <span className="doc-meta">{u.email}</span>
              </span>
              {pending === u.id && <span className="doc-meta" style={{ marginLeft: "auto" }}>Signing in…</span>}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
