'use client';

import { AlertCircle, ChevronDown, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUserLeagues } from '@/hooks/use-user-leagues';

import type { Route } from 'next';

interface LeagueSwitcherProps {
  currentLeagueName: string;
  currentLeagueSlug: string;
}

export function LeagueSwitcher({ currentLeagueName, currentLeagueSlug }: LeagueSwitcherProps) {
  const router = useRouter();
  const { leagues, isLoading, error, retry } = useUserLeagues();

  const handleLeagueSelect = (slug: string) => {
    if (slug !== currentLeagueSlug) {
      router.push(`/leagues/${slug}` as Route);
    }
  };

  const handleConnectLeague = () => {
    router.push('/connect-league' as Route);
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex min-w-0 max-w-full items-center gap-2 px-2 hover:bg-accent"
          data-testid="league-switcher-trigger"
        >
          <span className="truncate text-base font-semibold md:text-lg">{currentLeagueName}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" data-testid="league-switcher-dropdown">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-4 px-2" data-testid="dropdown-error">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">Failed to load leagues</p>
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </div>
        ) : leagues.length === 0 ? (
          <div className="py-2">
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={handleConnectLeague}>
              <Plus className="h-4 w-4" />
              <span>Connect your first league</span>
            </DropdownMenuItem>
          </div>
        ) : (
          <>
            {leagues.map((league) => (
              <DropdownMenuItem
                key={league.id}
                className="flex items-center gap-3 cursor-pointer py-2"
                onClick={() => handleLeagueSelect(league.slug)}
                data-testid="league-item"
              >
                <Avatar className="h-8 w-8" data-testid="league-logo">
                  <AvatarImage src={league.logoUrl} alt={league.name} />
                  <AvatarFallback className="text-xs">{getInitials(league.name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium truncate" data-testid="league-name-text">
                  {league.name}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={handleConnectLeague}>
              <Plus className="h-4 w-4" />
              <span>Connect Another League</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
