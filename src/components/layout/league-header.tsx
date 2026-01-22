'use client';

import { Menu } from 'lucide-react';

import { UserMenu } from '@/components/connect-league/user-menu';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { LeagueSwitcher } from './league-switcher';

interface LeagueHeaderProps {
  leagueName: string;
  leagueSlug: string;
  leagueAvatarUrl?: string;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
}

export function LeagueHeader({
  leagueName,
  leagueSlug,
  userName,
  userEmail,
  userAvatarUrl,
}: LeagueHeaderProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6">
      {/* Render both components, use CSS for responsive behavior to avoid hydration mismatch */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle navigation menu"
        data-testid="hamburger-button"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>

      <div className="min-w-0 flex-1">
        <LeagueSwitcher currentLeagueName={leagueName} currentLeagueSlug={leagueSlug} />
      </div>

      <UserMenu
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
      />
    </header>
  );
}
