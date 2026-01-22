import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function AppNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Alert variant="destructive" role="alert" data-testid="error-message" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Not Found</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>The page or resource you are looking for was not found. Please check the URL and try again.</span>
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
