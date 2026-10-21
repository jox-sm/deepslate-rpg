import Link from "next/link";
import CardsGridWrapper from '@/components/adventures/cards/cards-grid-wrapper';
import { FittedImage } from "@/components/shared/FittedImage";
import { Button } from "@/ui/primitives/button";
import { HeroEntrance, HeroEntranceItem, Magnetic } from "@/ui/primitives/motion";

export default function Page() {
  return (
    <div className="container-page pb-16">
      {/* Hero — split, left-aligned, fits first viewport */}
      <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
        <HeroEntrance className="max-w-xl">
          <HeroEntranceItem>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-6xl">
              Delve deeper. <span className="text-gradient">Tell it together.</span>
            </h1>
          </HeroEntranceItem>
          <HeroEntranceItem>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-text-secondary">
              Forge living dungeons, gather your party, and play the story as it unfolds.
            </p>
          </HeroEntranceItem>
          <HeroEntranceItem>
            <div className="mt-6 flex flex-wrap gap-3">
              <Magnetic>
                <Button asChild size="lg">
                  <Link href="/play">Start a delve</Link>
                </Button>
              </Magnetic>
              <Button asChild size="lg" variant="outline">
                <Link href="/inventory">Forge a world</Link>
              </Button>
            </div>
          </HeroEntranceItem>
        </HeroEntrance>
        <div className="dungeon-card overflow-hidden">
          <FittedImage
            src="/images/project.jpg"
            alt="A torch-lit dungeon gate"
            aspectRatio="16/10"
            priority
            showOverlay
          />
        </div>
      </section>

      {/* Codex — the adventure grid */}
      <section className="pt-4">
        <div className="mb-6 max-w-2xl">
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            The codex
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Every delve your table has forged, ready to enter.
          </p>
        </div>
        <CardsGridWrapper />
      </section>
    </div>
  );
}
