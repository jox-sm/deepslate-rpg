import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getGameById } from '@/lib/db';
import GameDetailClient from './game-detail';
import type { GamePageProps } from '@/types/gamePage';
import { classifyError } from '@/utilities/errorHandler';

export async function generateMetadata(
  { params }: GamePageProps
): Promise<Metadata> {
  try {
    const { uuid } = await params;
    const game = await getGameById(uuid);

    if (!game) {
      return {
        title: 'Game Not Found',
        description: 'The game you are looking for does not exist.',
      };
    }

    const gameTitle = game.name || 'Deepslate Dungeons';
    const gameDescription = game.description || 'Explore an epic game adventure in Deepslate Dungeons.';
    const gameImage = game.image || '/images/default-game.png';

    return {
      title: `${gameTitle} | Deepslate Dungeons`,
      description: gameDescription,
      openGraph: {
        title: gameTitle,
        description: gameDescription,
        images: [{ url: gameImage, width: 1200, height: 630, alt: gameTitle }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: gameTitle,
        description: gameDescription,
        images: [gameImage],
      },
    };
  } catch (error) {
    const classified = classifyError(error, "GamePage.generateMetadata");
    console.error('[GamePage] Error generating metadata:', classified.message);
    return {
      title: 'Game | Deepslate Dungeons',
      description: 'View game details in Deepslate Dungeons.',
    };
  }
}

export default async function GamePage({ params }: GamePageProps) {
  const { uuid } = await params;

  if (!uuid || typeof uuid !== 'string' || uuid.length < 10) {
    notFound();
  }

  try {
    const gameBasicInfo = await getGameById(uuid);

    if (!gameBasicInfo) {
      notFound();
    }

    return (
      <main className="min-h-screen bg-background">
        <GameDetailClient
          uuid={uuid}
          initialName={gameBasicInfo.name}
          initialDescription={gameBasicInfo.description}
          initialImage={gameBasicInfo.image}
        />
      </main>
    );
  } catch (error) {
    const classified = classifyError(error, "GamePage");
    console.error('[GamePage] Error rendering page:', classified.message);
    notFound();
  }
}
