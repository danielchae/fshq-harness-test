import Link from 'next/link';
import { Suspense } from 'react';

import { SignInForm } from '@/components/auth/sign-in-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Sign In',
  description: "Sign in to your FSHQ.gg account to access your fantasy leagues, pick'ems, and leaderboards",
  path: '/sign-in',
});

export default function SignInPage() {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="h-[200px] animate-pulse rounded-md bg-muted" />}>
          <SignInForm />
        </Suspense>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
