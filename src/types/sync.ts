// Types for league sync operations
// MOCK: Backend will replace with actual sync implementation

export interface SyncProgressResponse {
  progress: number;
  status: string;
}

export interface SyncResult {
  success: boolean;
  leagueSlug?: string;
  partial?: boolean;
  message?: string;
  error?: string;
}

export type SyncState = 'idle' | 'syncing' | 'success' | 'partial' | 'error';
