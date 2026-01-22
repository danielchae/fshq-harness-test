import { FeatureGrid, Hero } from '@/components/landing';
import { auth } from '@/lib/auth';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'FSHQ.gg - Fantasy Sports Clubhouse',
  description:
    "Your Fantasy Sports Clubhouse - Connect your Sleeper leagues, compete in pick'ems, track leaderboards, and dominate your fantasy sports experience",
  path: '/',
});

export default async function HomePage() {
  const session = await auth();
  const isAuthenticated = !!session?.user;

  return (
    <main className="min-h-screen bg-background">
      <Hero isAuthenticated={isAuthenticated} />
      <FeatureGrid />
    </main>
  );
}
