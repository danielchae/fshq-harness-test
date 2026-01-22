'use client';

import { Eye, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

interface PublicAccessBannerProps {
  leagueSlug: string;
  isAuthenticated: boolean;
}

/**
 * Banner shown to public visitors viewing a public league.
 * Displays read-only indicator and prompts for sign-in or sign-up.
 */
export function PublicAccessBanner({ leagueSlug, isAuthenticated }: PublicAccessBannerProps) {
  return (
    <div className="border-b bg-muted/50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>
            You&apos;re viewing this league in <strong className="text-foreground">read-only mode</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <span className="text-sm text-muted-foreground">
              Join this league to interact with content
            </span>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/sign-in?callbackUrl=/leagues/${leagueSlug}`}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/sign-up?callbackUrl=/leagues/${leagueSlug}`}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
