"use client";
import { useActionState } from "react";
import { updateShop } from "./actions";

const FIELDS = [
  ["name", "Name", "text"],
  ["tagline", "Tagline", "text"],
  ["hero_text", "Hero heading", "text"],
  ["hero_subtext", "Hero subtext", "text"],
  ["phone", "Public phone", "text"],
  ["email", "Public email", "text"],
  ["address", "Address", "text"],
  ["instagram", "Instagram handle", "text"],
  ["currency", "Currency code", "text"],
  ["timezone", "Timezone (IANA)", "text"],
  ["notify_phone", "Owner notify phone", "text"],
  ["notify_email", "Owner notify email", "text"],
];

export default function ShopForm({ shop }) {
  const [state, formAction, pending] = useActionState(updateShop, {});
  const err = state?.fieldErrors || {};
  return (
    <form action={formAction} className="admin-card" style={{ maxWidth: 520 }}>
      {FIELDS.map(([name, label, type]) => (
        <div key={name}>
          <label className="admin-label" htmlFor={name}>{label}</label>
          <input
            className="admin-input"
            id={name}
            name={name}
            type={type}
            defaultValue={shop[name] ?? ""}
          />
          {err[name]?.[0] ? <p className="field-error">{err[name][0]}</p> : null}
        </div>
      ))}
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.ok ? <p className="form-ok">Saved.</p> : null}
      <button className="admin-btn" type="submit" disabled={pending} style={{ marginTop: "1rem" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
