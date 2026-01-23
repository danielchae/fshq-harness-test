'use client';

import { ArrowRight, LogIn, Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface HeroProps {
  isAuthenticated: boolean;
}

export function Hero({ isAuthenticated }: HeroProps) {
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
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Go to My Leagues
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/connect-league">
                <Plus className="mr-1 h-4 w-4" />
                Connect New League
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Get Started Free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">
                <LogIn className="mr-1 h-4 w-4" />
                Sign In
              </Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
