// Feed and Moment types for the newsfeed feature

export type MomentType = 'post' | 'trade' | 'rankings' | 'prediction' | 'matchResult' | 'transaction' | 'pickems';

export interface TradeDetails {
  team1: string;
  team2: string;
  players1: string[];
  players2: string[];
}

export interface Moment {
  id: string;
  type: MomentType;
  content?: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  reactions?: Record<string, number>;
  userReactions?: string[]; // Emoji reactions the current user has added
  commentCount?: number;
  tradeDetails?: TradeDetails;
  // Moderation fields
  pinned?: boolean;
  hidden?: boolean;
}

export interface FeedResponse {
  moments: Moment[];
  nextCursor?: string | null;
}

// Comment types for moment detail page
export interface Comment {
  id: string;
  content: string;
  author: string;
  authorAvatar?: string;
  authorRole?: string;
  createdAt?: string;
  parentId?: string;
  isOwner?: boolean;
  reactions?: Record<string, number>;
  isEdited?: boolean;
}

export interface MomentDetail extends Moment {
  comments: Comment[];
}

export interface MomentDetailResponse {
  moment: MomentDetail | null;
}

export type FeedSortOption = 'recent' | 'chronological';

export interface GetFeedInput {
  leagueSlug: string;
  cursor?: string;
  limit?: number;
  sort?: FeedSortOption;
  type?: MomentType;
}
