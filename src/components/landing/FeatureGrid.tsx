import { ArrowLeftRight, Target, Trophy, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    title: 'Power Rankings',
    description: 'Commissioner-curated weekly rankings with trajectory tracking and expert commentary for your league.',
    icon: Trophy,
  },
  {
    title: "Pick'ems Competitions",
    description:
      'Predict weekly matchup winners with automated grading and season-long leaderboards for bragging rights.',
    icon: Target,
  },
  {
    title: 'Live Transactions',
    description: 'Real-time trade and waiver activity feed synced from Sleeper with reactions and discussion threads.',
    icon: ArrowLeftRight,
  },
  {
    title: 'Team Management',
    description:
      'Claim your team, manage your roster, and track your performance across seasons with detailed analytics.',
    icon: Users,
  },
];

export function FeatureGrid() {
  return (
    <section data-testid="feature-grid" className="border-t bg-muted/30 px-4 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Everything Your League Needs
          </h2>
          <p className="mt-3 text-muted-foreground">Powerful features designed for fantasy sports communities</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} data-testid="feature-card" className="border-transparent bg-background">
              <CardHeader className="pb-2">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <feature.icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="text-base font-medium">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
