'use client';

import { ShieldX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { leagueRoute } from '@/types/routes';

interface SettingsAccessDeniedProps {
  leagueSlug: string;
}

export function SettingsAccessDenied({ leagueSlug }: SettingsAccessDeniedProps) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to league home (feed) after a brief delay
    const timeout = setTimeout(() => {
      router.push(leagueRoute(leagueSlug));
    }, 3000);

    return () => clearTimeout(timeout);
  }, [leagueSlug, router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center" data-testid="access-denied">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You are not authorized to access League Settings. This area is reserved for league administrators only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Redirecting you to the league home...</p>
        </CardContent>
      </Card>
    </div>
  );
}
