'use client';

import { ArrowLeft, CheckSquare, FileText, MessageSquare, Package, TrendingUp, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ReactionDisplay } from '@/components/feed/reaction-display';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CommentInput } from './comment-input';
import { CommentThread } from './comment-thread';

import type { Comment, MomentDetail, MomentType } from '@/types/feed';

interface MomentDetailViewProps {
  moment: MomentDetail;
  leagueSlug: string;
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

export function MomentDetailView({ moment, leagueSlug }: MomentDetailViewProps) {
  const [comments, setComments] = useState<Comment[]>(moment.comments);

  const config = momentTypeConfig[moment.type] || momentTypeConfig.post;
  const Icon = config.icon;

  const handleAddComment = async (content: string) => {
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: moment.id, content }),
      });

      if (response.ok) {
        const newComment = await response.json();
        // Optimistic update
        setComments((prev) => [...prev, newComment]);
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: moment.id, content, parentId }),
      });

      if (response.ok) {
        const newComment = await response.json();
        // Optimistic update with parent reference
        setComments((prev) => [...prev, { ...newComment, parentId }]);
      }
    } catch (error) {
      console.error('Failed to add reply:', error);
    }
  };

  const handleEdit = async (commentId: string, newContent: string) => {
    try {
      const response = await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, content: newContent }),
      });

      if (response.ok) {
        const updatedComment = await response.json();
        // Optimistic update
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, content: updatedComment.content, isEdited: updatedComment.isEdited } : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to edit comment:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Optimistic update - remove comment and its replies
        setComments((prev) => {
          const idsToRemove = new Set<string>();
          const findDescendants = (id: string) => {
            idsToRemove.add(id);
            prev.filter((c) => c.parentId === id).forEach((child) => findDescendants(child.id));
          };
          findDescendants(commentId);
          return prev.filter((c) => !idsToRemove.has(c.id));
        });
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        href={`/leagues/${leagueSlug}` as `/leagues/${string}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Feed
      </Link>

      {/* Moment Content */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {moment.authorName && (
                <Avatar className="h-10 w-10">
                  {moment.authorAvatar && <AvatarImage src={moment.authorAvatar} alt={moment.authorName} />}
                  <AvatarFallback>{moment.authorName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex flex-col">
                {moment.authorName && <span className="font-medium">{moment.authorName}</span>}
                <span className="text-xs text-muted-foreground">
                  {new Date(moment.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
            <Badge variant={config.variant} className="gap-1">
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {moment.content && (
            <p data-testid="moment-content" className="text-base">
              {moment.content}
            </p>
          )}

          {/* Reactions */}
          <div className="pt-2">
            <ReactionDisplay targetId={moment.id} reactions={moment.reactions} userReactions={moment.userReactions} />
          </div>

          <Separator />

          {/* Comments Section */}
          <div className="space-y-4">
            <h3 className="font-semibold">Comments ({comments.length})</h3>

            {/* Comment Input */}
            <CommentInput onSubmit={handleAddComment} placeholder="Write a comment..." />

            {/* Comment Thread */}
            <CommentThread comments={comments} onReply={handleReply} onEdit={handleEdit} onDelete={handleDelete} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
