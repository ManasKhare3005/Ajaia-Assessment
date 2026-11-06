import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { SignInList } from "./SignInList";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .orderBy(schema.users.name);

  return (
    <main className="signin">
      <span className="wordmark">
        <span className="wordmark-mark" aria-hidden />
        Ajaia Docs
      </span>
      <h1>Sign in</h1>
      <p className="sub">Choose a demo account. To test sharing, share a document from one account, then switch to another.</p>
      <SignInList users={users} />
      <p className="signin-note">
        This demo uses mock sign-in with seeded accounts, so there are no passwords.
      </p>
    </main>
  );
}
