import { Settings } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { FanAccessSettings } from '@/components/settings/fan-access-settings';
import { JoinRulesToggle } from '@/components/settings/join-rules-toggle';
import { LeagueDescriptionEditor } from '@/components/settings/league-description-editor';
import { ResyncLeague } from '@/components/settings/resync-league';
import { SettingsAccessDenied } from '@/components/settings/settings-access-denied';
import { VisibilityToggle } from '@/components/settings/visibility-toggle';
import { getLeagueSettings } from '@/data/settings/get-league-settings';
import { getUserRole, hasRole } from '@/lib/auth/get-user-role';

interface LeagueSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeagueSettingsPage({ params }: LeagueSettingsPageProps) {
  const { slug } = await params;

  // Check user role for access
  const userRole = await getUserRole(slug);
  const isAdmin = hasRole(userRole, 'admin');

  // If not admin, show access denied
  if (!isAdmin) {
    return <SettingsAccessDenied leagueSlug={slug} />;
  }

  // Get current settings
  const settings = await getLeagueSettings({ slug });

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">League settings not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="League Settings"
        description="Configure visibility, membership, and league information"
      />

      {/* Settings Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visibility Settings */}
        <VisibilityToggle leagueSlug={slug} initialVisibility={settings.visibility} />

        {/* Join Rules */}
        <JoinRulesToggle leagueSlug={slug} initialJoinRule={settings.joinRule} />

        {/* Fan Access */}
        <FanAccessSettings
          leagueSlug={slug}
          initialEnabled={settings.fanAccessEnabled}
          initialFanLimit={settings.fanLimit}
          currentFanCount={settings.currentFanCount}
        />
      </div>

      {/* Description Editor (Full Width) */}
      <LeagueDescriptionEditor leagueSlug={slug} initialDescription={settings.description} />

      {/* Data Sync */}
      <ResyncLeague leagueSlug={slug} platform={settings.platform} platformLeagueId={settings.platformLeagueId} />
    </div>
  );
}
