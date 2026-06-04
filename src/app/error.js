"use client";

export default function GlobalError({ reset }) {
  return (
    <main style={{ padding: "4rem 1.5rem" }}>
      <h1>Something went wrong</h1>
      <p>Please try again.</p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
