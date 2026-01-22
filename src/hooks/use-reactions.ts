'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface UseReactionsOptions {
  targetId: string;
  targetType: 'moment' | 'comment';
  initialReactions?: Record<string, number>;
  initialUserReactions?: string[];
}

interface UseReactionsReturn {
  reactions: Record<string, number>;
  userReactions: string[];
  isLoading: boolean;
  toggleReaction: (emoji: string) => Promise<void>;
  hasUserReacted: (emoji: string) => boolean;
}

export function useReactions({
  targetId,
  targetType,
  initialReactions = {},
  initialUserReactions = [],
}: UseReactionsOptions): UseReactionsReturn {
  const [reactions, setReactions] = useState<Record<string, number>>(initialReactions);
  const [userReactions, setUserReactions] = useState<string[]>(initialUserReactions);
  const [isLoading, setIsLoading] = useState(false);

  const hasUserReacted = useCallback((emoji: string) => userReactions.includes(emoji), [userReactions]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      const hadReacted = userReactions.includes(emoji);

      // Optimistic update
      setReactions((prev) => {
        const currentCount = prev[emoji] || 0;
        const newCount = hadReacted ? Math.max(0, currentCount - 1) : currentCount + 1;

        if (newCount === 0) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [emoji]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [emoji]: newCount };
      });

      setUserReactions((prev) => (hadReacted ? prev.filter((e) => e !== emoji) : [...prev, emoji]));

      setIsLoading(true);

      try {
        const method = hadReacted ? 'DELETE' : 'POST';
        const url = hadReacted
          ? `/api/reactions?targetId=${encodeURIComponent(targetId)}&targetType=${targetType}&emoji=${encodeURIComponent(emoji)}`
          : '/api/reactions';

        const response = await fetch(url, {
          method,
          headers: hadReacted ? undefined : { 'Content-Type': 'application/json' },
          body: hadReacted ? undefined : JSON.stringify({ targetId, targetType, emoji }),
        });

        if (!response.ok) {
          throw new Error('Failed to toggle reaction');
        }
      } catch {
        // Revert optimistic update
        setReactions((prev) => {
          const currentCount = prev[emoji] || 0;
          const revertedCount = hadReacted ? currentCount + 1 : Math.max(0, currentCount - 1);

          if (revertedCount === 0) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [emoji]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [emoji]: revertedCount };
        });

        setUserReactions((prev) => (hadReacted ? [...prev, emoji] : prev.filter((e) => e !== emoji)));

        toast.error('Failed to update reaction. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [targetId, targetType, userReactions]
  );

  return {
    reactions,
    userReactions,
    isLoading,
    toggleReaction,
    hasUserReacted,
  };
}
