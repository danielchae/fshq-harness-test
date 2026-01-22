import { ShieldX } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { leagueRoute } from '@/types/routes';

interface AccessDeniedProps {
  leagueSlug: string;
}

export function AccessDenied({ leagueSlug }: AccessDeniedProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center" data-testid="access-denied">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You are not authorized to access the Commissioner Desk. This area is reserved for league commissioners only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please contact your league commissioner.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href={leagueRoute(leagueSlug)}>Return to League</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
