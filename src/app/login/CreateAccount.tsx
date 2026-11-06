"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api-client";

/** Lets a tester make their own demo account (no password, like the rest of the mocked sign-in). */
export function CreateAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({ name, email }) });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        className="btn create-toggle"
        onClick={() => {
          setOpen(true);
          setTimeout(() => nameRef.current?.focus(), 0);
        }}
      >
        Create a demo account
      </button>
    );
  }

  return (
    <form className="create-account" onSubmit={submit} noValidate>
      <h2 className="signin-label">Create a demo account</h2>
      <label className="field">
        <span>Name</span>
        <input ref={nameRef} className="input" value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" value={email} maxLength={254} autoComplete="email" placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
      </label>
      <p className="helper">Other people can share documents with you using this email. There&rsquo;s no password.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="create-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={pending || !name.trim() || !email.trim()}>
          {pending ? "Creating…" : "Create account and sign in"}
        </button>
      </div>
    </form>
  );
}
