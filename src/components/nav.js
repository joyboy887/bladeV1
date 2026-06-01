import Link from "next/link";
import { Button } from "@/components/ui/button.js";
import { Container } from "@/components/ui/container.js";

export function Nav({ shopName }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-wide">
          <span className="text-blade-red text-glow-red">{shopName}</span>
        </Link>
        <Button as="link" href="/booking" variant="green" className="h-10 min-h-0 px-5 text-sm">
          Book Now
        </Button>
      </Container>
    </header>
  );
}
