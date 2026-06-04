import Image from "next/image";
import { Button } from "@/components/ui/button.js";
import { Container } from "@/components/ui/container.js";

export function Hero({ shop }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/neon-sign.webp"
          alt="The Blade Hair Studio neon sign"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />
      </div>
      <Container className="relative flex min-h-[78vh] flex-col items-start justify-center py-20">
        <h1 className="max-w-3xl text-5xl leading-[0.95] sm:text-7xl">{shop.name}</h1>
        <p className="mt-4 text-2xl text-blade-green text-glow-green sm:text-3xl">{shop.tagline}</p>
        {shop.hero_text ? <p className="mt-4 max-w-xl text-muted">{shop.hero_text}</p> : null}
        <Button as="link" href="/booking" variant="primary" className="mt-8">
          Book Now
        </Button>
      </Container>
    </section>
  );
}
