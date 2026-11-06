"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, initials } from "@/lib/api-client";

export function TopBar({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  async function signOut() {
    await api("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        <span className="wordmark-mark" aria-hidden />
        Ajaia Docs
      </Link>
      <span className="topbar-spacer" />
      <span className="user-chip" title={user.email}>
        <span className="avatar" aria-hidden>
          {initials(user.name)}
        </span>
        <span>{user.name}</span>
      </span>
      <button className="btn btn-ghost" onClick={signOut}>
        Switch user
      </button>
    </header>
  );
}
