'use client';

import { useReactions } from '@/hooks/use-reactions';
import { cn } from '@/lib/utils';
import { ReactionPicker } from './reaction-picker';

// Labels for reaction emojis for screen readers
const REACTION_LABELS: Record<string, string> = {
  '👍': 'thumbs up',
  '❤️': 'heart',
  '🔥': 'fire',
  '😂': 'laughing',
  '😮': 'surprised',
  '😢': 'sad',
  '🎉': 'celebration',
  '👀': 'eyes',
};

interface ReactionDisplayProps {
  targetId: string;
  targetType?: 'moment' | 'comment';
  reactions?: Record<string, number>;
  userReactions?: string[];
}

export function ReactionDisplay({
  targetId,
  targetType = 'moment',
  reactions: initialReactions,
  userReactions: initialUserReactions,
}: ReactionDisplayProps) {
  const { reactions, toggleReaction, hasUserReacted, isLoading } = useReactions({
    targetId,
    targetType,
    initialReactions,
    initialUserReactions,
  });

  const hasReactions = reactions && Object.keys(reactions).length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Existing reactions display */}
      {hasReactions && (
        <div data-testid="reaction-display" className="flex items-center gap-1 flex-wrap">
          {Object.entries(reactions).map(([emoji, count]) => {
            const isUserReaction = hasUserReacted(emoji);
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                disabled={isLoading}
                aria-label={`${REACTION_LABELS[emoji] || emoji} reaction, ${count} ${count === 1 ? 'person' : 'people'}`}
                data-testid={isUserReaction ? 'active-reaction' : undefined}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
                  'hover:bg-muted/80 cursor-pointer',
                  isUserReaction
                    ? 'bg-primary/10 border border-primary/30 text-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <span>{emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Add reaction button */}
      <ReactionPicker onSelect={toggleReaction} disabled={isLoading} />
    </div>
  );
}
