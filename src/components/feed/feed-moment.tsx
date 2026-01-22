'use client';

import { CheckSquare, FileText, MessageSquare, Package, Pin, TrendingUp, Trophy } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useUser } from '@/hooks/use-user';
import { ModerationMenu } from './moderation-menu';
import { ReactionDisplay } from './reaction-display';
import { TradeMoment } from './trade-moment';

import type { Moment, MomentType } from '@/types/feed';

interface FeedMomentProps {
  moment: Moment;
  /** Callback when moment is removed (hidden or deleted) - removes from feed list */
  onMomentRemoved?: (momentId: string) => void;
}

const momentTypeConfig: Record<
  MomentType,
  { label: string; icon: React.ComponentType<{ className?: string }>; variant: 'default' | 'secondary' | 'outline' }
> = {
  post: { label: 'Post', icon: MessageSquare, variant: 'secondary' },
  trade: { label: 'Trade', icon: Package, variant: 'secondary' },
  rankings: { label: 'Rankings', icon: TrendingUp, variant: 'default' },
  prediction: { label: 'Prediction', icon: TrendingUp, variant: 'outline' },
  matchResult: { label: 'Match Result', icon: Trophy, variant: 'default' },
  transaction: { label: 'Transaction', icon: FileText, variant: 'secondary' },
  pickems: { label: "Pick'ems", icon: CheckSquare, variant: 'default' },
};

export function FeedMoment({ moment, onMomentRemoved }: FeedMomentProps) {
  const { isAdmin } = useUser();
  const [isPinned, setIsPinned] = useState(moment.pinned ?? false);
  const [isLoading, setIsLoading] = useState(false);

  // Use TradeMoment for trade type
  if (moment.type === 'trade') {
    return <TradeMoment moment={moment} onMomentRemoved={onMomentRemoved} />;
  }

  const { id, content, createdAt, authorName, authorAvatar, reactions, userReactions, commentCount, type } = moment;
  const config = momentTypeConfig[type] || momentTypeConfig.post;
  const Icon = config.icon;

  const handlePin = async () => {
    if (isLoading) return;
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnpin = async () => {
    if (isLoading) return;
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleHide = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/moderation/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: id }),
      });
      const data = await response.json();
      if (data.success) {
        // Remove from parent's list after successful API call
        onMomentRemoved?.(id);
      }
    } catch (error) {
      console.error('Failed to hide moment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/moderation/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: id }),
      });
      const data = await response.json();
      if (data.success) {
        // Remove from parent's list after successful API call
        onMomentRemoved?.(id);
      }
    } catch (error) {
      console.error('Failed to delete moment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card data-testid="feed-moment" data-moment-type={type}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {authorName && (
              <Avatar className="h-8 w-8">
                {authorAvatar && <AvatarImage src={authorAvatar} alt={authorName} />}
                <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex flex-col">
              {authorName && <span className="text-sm font-medium">{authorName}</span>}
              <span className="text-xs text-muted-foreground">{new Date(createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-10 sm:pl-0">
            {isPinned && (
              <Badge variant="default" className="gap-1" data-testid="pinned-badge">
                <Pin className="h-4 w-4" aria-hidden="true" />
                Pinned
              </Badge>
            )}
            <Badge variant={config.variant} className="gap-1" data-testid="moment-type-badge">
              <Icon className="h-4 w-4" aria-hidden="true" />
              {config.label}
            </Badge>
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
