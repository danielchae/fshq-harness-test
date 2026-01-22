'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

import type { Route } from 'next';

interface HeroProps {
  isAuthenticated: boolean;
}

export function Hero({ isAuthenticated }: HeroProps) {
  const router = useRouter();

  const handleConnectLeague = () => {
    if (isAuthenticated) {
      router.push('/connect-league' as Route);
    } else {
      router.push('/sign-in' as Route);
    }
  };

  const handleGoToLeagues = () => {
    router.push('/dashboard' as Route);
  };

  return (
    <section
      data-testid="hero-section"
      className="flex flex-col items-center justify-center px-4 py-20 text-center md:py-28 lg:py-36"
    >
      <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl">
        Your Fantasy Sports
        <br />
        <span className="text-muted-foreground">Clubhouse</span>
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
        Connect your Sleeper league and unlock powerful tools for commissioners, managers, and fans.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        {isAuthenticated ? (
          <>
            <Button size="lg" onClick={handleGoToLeagues}>
              Go to My Leagues
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleConnectLeague}>
              Connect New League
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" onClick={handleConnectLeague}>
              Get Started
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/sign-in' as Route)}>
              Sign In
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
