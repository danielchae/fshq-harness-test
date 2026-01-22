import Link from 'next/link';

import { SignUpForm } from '@/components/auth/sign-up-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Sign Up',
  description: 'Create your FSHQ.gg account and join the ultimate fantasy sports clubhouse',
  path: '/sign-up',
});

export default function SignUpPage() {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-xl font-semibold">Create an account</CardTitle>
        <CardDescription>Enter your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
