import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: "4rem 1.5rem" }}>
      <h1>Page not found</h1>
      <Link href="/">Back to home</Link>
    </main>
  );
}
