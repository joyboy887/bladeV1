"use client";
import { useActionState } from "react";
import { signIn } from "./actions";
import "../admin.css";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, {});
  return (
    <div className="admin-login">
      <form action={formAction} className="admin-card" style={{ width: 340 }}>
        <h1 className="admin-h1">The Blade — Admin</h1>
        <label className="admin-label" htmlFor="email">Email</label>
        <input className="admin-input" id="email" name="email" type="email" autoComplete="username" required />
        <label className="admin-label" htmlFor="password">Password</label>
        <input className="admin-input" id="password" name="password" type="password" autoComplete="current-password" required />
        {state?.error ? <p className="form-error">{state.error}</p> : null}
        <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "1rem", width: "100%" }}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
