// Moderation types for the admin moderation queue

export interface HiddenMoment {
  id: string;
  content: string;
  hideReason: string;
  hiddenAt: string;
  hiddenBy?: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  type?: 'post' | 'trade' | 'comment';
  originalCreatedAt?: string;
}

export interface HiddenMomentsResponse {
  hiddenMoments: HiddenMoment[];
}

export interface UnhideMomentResponse {
  success: boolean;
  error?: string;
}

export interface DeleteMomentResponse {
  success: boolean;
  error?: string;
}
