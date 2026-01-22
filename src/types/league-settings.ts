// League settings types for admin configuration

export interface LeagueSettings {
  id: string;
  leagueId: string;
  leagueSlug: string;
  platform: 'sleeper' | 'espn' | 'yahoo';
  platformLeagueId?: string | null;

  // Visibility settings
  visibility: 'public' | 'private';

  // Join rules
  joinRule: 'auto-join' | 'approval-required';

  // Fan access
  fanAccessEnabled: boolean;
  fanLimit: number | null; // null means unlimited
  currentFanCount: number;

  // Description
  description: string;

  // Content visibility (for private leagues)
  publicContent: {
    rankings: boolean;
    matchups: boolean;
    brackets: boolean;
    transactions: boolean;
    history: boolean;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface LeagueSettingsUpdate {
  visibility?: 'public' | 'private';
  joinRule?: 'auto-join' | 'approval-required';
  fanAccessEnabled?: boolean;
  fanLimit?: number | null;
  description?: string;
  publicContent?: Partial<LeagueSettings['publicContent']>;
}
