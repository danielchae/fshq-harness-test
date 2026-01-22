import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function LeagueNotFound() {
  return (
    <div className="p-4 lg:p-6">
      <Alert variant="destructive" role="alert" data-testid="error-message">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>League Not Found</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>The league you are looking for was not found. Please check the URL and try again.</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="w-fit">
              <Link href="/">
                <RefreshCw className="h-4 w-4 mr-2" />
                Go Home
              </Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
