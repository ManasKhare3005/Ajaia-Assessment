import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { TopBar } from "@/components/TopBar";
import { listDocuments } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { owned, shared } = await listDocuments(user);
  return (
    <>
      <TopBar user={user} />
      <Dashboard firstName={user.name.split(" ")[0]} owned={owned} shared={shared} />
    </>
  );
}
