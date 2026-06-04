import Link from "next/link";

const base =
  "inline-flex items-center justify-center rounded-full font-semibold tracking-wide " +
  "transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none " +
  "min-h-12 px-7 text-base";

const variants = {
  primary: "bg-blade-red text-white glow-red hover:brightness-110",
  green: "bg-blade-green text-ink glow-green hover:brightness-110",
  ghost: "border border-white/15 text-fog hover:border-white/40 bg-white/5",
};

export function Button({ as = "button", variant = "primary", className = "", href, ...props }) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (as === "link") return <Link href={href} className={cls} {...props} />;
  return <button className={cls} {...props} />;
}
