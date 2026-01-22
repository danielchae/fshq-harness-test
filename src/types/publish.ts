// Types for publish flow
// Used by both frontend and backend

export interface ValidationError {
  section: 'power-rankings' | 'matchup-predictions' | 'posts' | 'general';
  message: string;
  details?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface PublishRequest {
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  skipSections?: ('power-rankings' | 'matchup-predictions' | 'posts')[];
}

export interface PublishResponse {
  success: boolean;
  error?: string;
  rankingsUrl?: string;
  feedUrl?: string;
  matchupsUrl?: string;
  publishedAt?: string;
  feedMomentsCreated?: number;
}
