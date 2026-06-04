import Image from "next/image";
import { Container } from "@/components/ui/container.js";

const SHOTS = [
  { src: "/images/interior-wide.webp", alt: "Studio interior" },
  { src: "/images/cut-1.webp", alt: "Finished cut" },
  { src: "/images/interior-chairs.webp", alt: "Barber chairs" },
  { src: "/images/cut-2.webp", alt: "Finished cut" },
  { src: "/images/entrance.webp", alt: "Studio entrance" },
];

export function Gallery() {
  return (
    <section className="py-16">
      <Container>
        <h2 className="text-4xl">The Studio</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SHOTS.map((s) => (
            <div
              key={s.src}
              className="relative aspect-square overflow-hidden rounded-xl border border-white/10"
            >
              <Image
                src={s.src}
                alt={s.alt}
                fill
                sizes="(max-width:640px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
