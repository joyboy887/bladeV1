import Link from "next/link";
import { signOut } from "@/app/admin/login/actions";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/barbers", label: "Barbers" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/closures", label: "Closures" },
  { href: "/admin/shop", label: "Shop content" },
];

export default function AdminNav() {
  return (
    <nav className="admin-nav">
      <div className="brand">The Blade</div>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href}>{l.label}</Link>
      ))}
      <form action={signOut} style={{ marginTop: "1.5rem" }}>
        <button className="admin-btn admin-btn-secondary" type="submit" style={{ width: "100%" }}>
          Sign out
        </button>
      </form>
    </nav>
  );
}
