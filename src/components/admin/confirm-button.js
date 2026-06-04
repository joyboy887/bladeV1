"use client";

// Renders a submit button inside a form bound to a server action.
// If `confirm` is set, asks for confirmation before submitting.
export default function ConfirmButton({ action, label, confirm = null, danger = false }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <button className={`admin-btn ${danger ? "admin-btn-danger" : "admin-btn-secondary"}`} type="submit">
        {label}
      </button>
    </form>
  );
}
