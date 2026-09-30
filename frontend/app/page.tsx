import { Hero } from "@/components/landing/Hero";
import { PipelineBand } from "@/components/landing/PipelineBand";
import { ToolGrid } from "@/components/landing/ToolGrid";
import { SequenceDeck } from "@/components/landing/SequenceDeck";
import { Footer } from "@/components/landing/Footer";

/**
 * Landing page. Server-rendered shell with client islands for motion; the
 * hero 3D scene is dynamically imported (ssr: false) so the page ships
 * without a three.js payload in the initial HTML.
 */
export default function LandingPage() {
  return (
    <main>
      <Hero />
      <PipelineBand />
      <ToolGrid />
      <SequenceDeck />
      <Footer />
    </main>
  );
}
