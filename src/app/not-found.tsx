import Link from "next/link";

export default function NotFound() {
  return (
    <main className="signin">
      <h1>Document not found</h1>
      <p className="sub">
        It may have been deleted, or it hasn&rsquo;t been shared with the account you&rsquo;re signed in as.
      </p>
      <Link href="/" className="btn btn-primary">
        Back to my documents
      </Link>
    </main>
  );
}
