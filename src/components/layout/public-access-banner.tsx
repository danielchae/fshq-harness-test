'use client';

import { CheckCircle, Clock, Eye, Loader2, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface PublicAccessBannerProps {
  leagueSlug: string;
  isAuthenticated: boolean;
}

/**
 * Banner shown to public visitors viewing a public league.
 * Displays read-only indicator and prompts for sign-in or sign-up.
 * Authenticated users can request to join directly.
 */
export function PublicAccessBanner({ leagueSlug, isAuthenticated }: PublicAccessBannerProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joined' | 'pending' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/join`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        if (result.status === 'joined' || result.status === 'already_member') {
          setJoinStatus('joined');
          // Refresh the page to update access
          setTimeout(() => {
            router.refresh();
          }, 1000);
        } else if (result.status === 'pending' || result.status === 'already_pending') {
          setJoinStatus('pending');
        }
      } else {
        setJoinStatus('error');
        setErrorMessage(result.message || 'Failed to join league');
      }
    } catch (error) {
      console.error('Error joining league:', error);
      setJoinStatus('error');
      setErrorMessage('Failed to join league. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="border-b bg-muted/50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>
            {joinStatus === 'joined' ? (
              <>Welcome! Refreshing your access...</>
            ) : joinStatus === 'pending' ? (
              <>Your request to join is pending commissioner approval</>
            ) : (
              <>
                You&apos;re viewing this league in <strong className="text-foreground">read-only mode</strong>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            joinStatus === 'idle' ? (
              <Button
                size="sm"
                onClick={handleJoin}
                disabled={isJoining}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join League
                  </>
                )}
              </Button>
            ) : joinStatus === 'joined' ? (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Joined!
              </span>
            ) : joinStatus === 'pending' ? (
              <span className="flex items-center gap-1 text-sm text-yellow-600">
                <Clock className="h-4 w-4" />
                Request Pending
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">{errorMessage}</span>
                <Button size="sm" variant="outline" onClick={handleJoin}>
                  Try Again
                </Button>
              </div>
            )
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
