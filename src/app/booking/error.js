"use client";

import { Container } from "@/components/ui/container.js";
import { Button } from "@/components/ui/button.js";

export default function BookingError({ reset }) {
  return (
    <main className="py-20">
      <Container>
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="mt-2 text-muted">We couldn’t load the booking page. Please try again.</p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </Container>
    </main>
  );
}
