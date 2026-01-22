'use client';

import { ArrowLeftRight, Pin } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useUser } from '@/hooks/use-user';
import { ModerationMenu } from './moderation-menu';
import { ReactionDisplay } from './reaction-display';

import type { Moment } from '@/types/feed';

interface TradeMomentProps {
  moment: Moment;
  onMomentHidden?: (momentId: string) => void;
}

export function TradeMoment({ moment, onMomentHidden }: TradeMomentProps) {
  const { isAdmin } = useUser();
  const [isPinned, setIsPinned] = useState(moment.pinned ?? false);
  const [isHidden, setIsHidden] = useState(false);

  const { id, tradeDetails, reactions, userReactions, commentCount, createdAt, content } = moment;

  const handlePin = async () => {
    try {
      const response = await fetch('/api/moderation/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: id, pin: true }),
      });
      const data = await response.json();
      if (data.success) {
        setIsPinned(true);
      }
    } catch (error) {
      console.error('Failed to pin moment:', error);
    }
  };

  const handleUnpin = async () => {
    try {
      const response = await fetch('/api/moderation/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: id, pin: false }),
      });
      const data = await response.json();
      if (data.success) {
        setIsPinned(false);
      }
    } catch (error) {
      console.error('Failed to unpin moment:', error);
    }
  };

  const handleHide = async () => {
    try {
      const response = await fetch('/api/moderation/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: id }),
      });
      const data = await response.json();
      if (data.success) {
        setIsHidden(true);
        onMomentHidden?.(id);
      }
    } catch (error) {
      console.error('Failed to hide moment:', error);
    }
  };

  const handleDelete = async () => {
    // For now, delete acts same as hide
    handleHide();
  };

  // Don't render if hidden
  if (isHidden) {
    return null;
  }

  // If no tradeDetails, render a simple trade card with content
  if (!tradeDetails) {
    return (
      <Card data-testid="feed-moment" data-moment-type="trade">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPinned && (
                <Badge variant="default" className="gap-1" data-testid="pinned-badge">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1" data-testid="moment-type-badge">
                <ArrowLeftRight className="h-3 w-3" />
                Trade
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{new Date(createdAt).toLocaleDateString()}</span>
              {isAdmin && (
                <ModerationMenu
                  momentId={id}
                  isPinned={isPinned}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onHide={handleHide}
                  onDelete={handleDelete}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {content && <p className="text-sm">{content}</p>}
          <div className="flex items-center justify-between pt-2 border-t">
            <ReactionDisplay targetId={id} reactions={reactions} userReactions={userReactions} />
            {commentCount !== undefined && commentCount > 0 && (
              <span className="text-xs text-muted-foreground">{commentCount} comments</span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { team1, team2, players1, players2 } = tradeDetails;

  return (
    <Card data-testid="feed-moment" data-moment-type="trade">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPinned && (
              <Badge variant="default" className="gap-1" data-testid="pinned-badge">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              Trade
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{new Date(createdAt).toLocaleDateString()}</span>
            {isAdmin && (
              <ModerationMenu
                momentId={id}
                isPinned={isPinned}
                onPin={handlePin}
                onUnpin={handleUnpin}
                onHide={handleHide}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Team 1 */}
          <div className="space-y-2">
            <div className="font-medium text-sm">{team1}</div>
            <div className="space-y-1">
              {players1.map((player, idx) => (
                <div key={idx} className="text-sm bg-muted rounded px-2 py-1 text-muted-foreground">
                  {player}
                </div>
              ))}
            </div>
          </div>

          {/* Trade Arrow */}
          <div className="flex flex-col items-center justify-center">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Team 2 */}
          <div className="space-y-2 text-right">
            <div className="font-medium text-sm">{team2}</div>
            <div className="space-y-1">
              {players2.map((player, idx) => (
                <div key={idx} className="text-sm bg-muted rounded px-2 py-1 text-muted-foreground">
                  {player}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reactions and Comments */}
        <div className="flex items-center justify-between pt-2 border-t">
          <ReactionDisplay targetId={id} reactions={reactions} userReactions={userReactions} />
          {commentCount !== undefined && commentCount > 0 && (
            <span className="text-xs text-muted-foreground">{commentCount} comments</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
