import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { CreateAccount } from "./CreateAccount";
import { SignInList } from "./SignInList";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await listUsers();
  const demo = users.filter((u) => u.seeded);
  const created = users.filter((u) => !u.seeded);

  return (
    <main className="signin">
      <span className="wordmark">
        <span className="wordmark-mark" aria-hidden />
        Ajaia Docs
      </span>
      <h1>Sign in</h1>
      <p className="sub">Choose a demo account, or create your own. To test sharing, share a document from one account, then switch to another.</p>
      <SignInList users={demo} label="Demo accounts" />
      {created.length > 0 && <SignInList users={created} label="Accounts created by testers" />}
      <CreateAccount />
      <p className="signin-note">
        Sign-in is mocked for this demo, so there are no passwords and anyone can use any account.
      </p>
    </main>
  );
}
