import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function MomentNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Moment not found</h1>
          <p className="text-muted-foreground">
            The moment you&apos;re looking for doesn&apos;t exist or may have been removed.
          </p>
          <Button asChild>
            <Link href="/">Return to Feed</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
