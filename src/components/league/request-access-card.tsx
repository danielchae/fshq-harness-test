'use client';

import { CheckCircle, Clock, Lock, Loader2, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface RequestAccessCardProps {
  leagueSlug: string;
  leagueName: string;
  leagueAvatarUrl?: string | null;
  isAuthenticated: boolean;
}

/**
 * Card shown when a user tries to access a private league they're not a member of.
 * Provides options to sign in, sign up, or request to join.
 */
export function RequestAccessCard({
  leagueSlug,
  leagueName,
  leagueAvatarUrl,
  isAuthenticated,
}: RequestAccessCardProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joined' | 'pending' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/join`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setMessage(result.message);
        if (result.status === 'joined' || result.status === 'already_member') {
          setJoinStatus('joined');
          // Refresh to gain access
          setTimeout(() => {
            router.refresh();
          }, 1500);
        } else if (result.status === 'pending' || result.status === 'already_pending') {
          setJoinStatus('pending');
        }
      } else {
        setJoinStatus('error');
        setMessage(result.message || 'Failed to request access');
      }
    } catch (error) {
      console.error('Error requesting access:', error);
      setJoinStatus('error');
      setMessage('Failed to request access. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {leagueAvatarUrl ? (
              <img
                src={leagueAvatarUrl}
                alt={leagueName}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <Lock className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <CardTitle>{leagueName}</CardTitle>
          <CardDescription>
            {joinStatus === 'pending' ? (
              'Your request is awaiting commissioner approval'
            ) : joinStatus === 'joined' ? (
              'Access granted! Redirecting...'
            ) : (
              'This league is private. Request access to view content.'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {joinStatus === 'pending' && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-yellow-500/10 p-4 text-sm text-yellow-600">
              <Clock className="h-5 w-5" />
              <span>{message || 'Your request has been submitted'}</span>
            </div>
          )}

          {joinStatus === 'joined' && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 p-4 text-sm text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>{message || 'Welcome to the league!'}</span>
            </div>
          )}

          {joinStatus === 'error' && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {message || 'Something went wrong'}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {isAuthenticated ? (
            joinStatus === 'idle' ? (
              <Button
                className="w-full"
                onClick={handleJoin}
                disabled={isJoining}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting Access...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Request to Join
                  </>
                )}
              </Button>
            ) : joinStatus === 'error' ? (
              <Button className="w-full" onClick={handleJoin} disabled={isJoining}>
                Try Again
              </Button>
            ) : null
          ) : (
            <>
              <Button className="w-full" asChild>
                <Link href={`/sign-in?callbackUrl=/leagues/${leagueSlug}`}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In to Request Access
                </Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/sign-up?callbackUrl=/leagues/${leagueSlug}`}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </Link>
              </Button>
            </>
          )}

          <Button variant="ghost" className="w-full" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
