'use client';

import { Edit, MessageSquare, Trash } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommentInput } from './comment-input';

import type { Comment as CommentType } from '@/types/feed';

interface CommentProps {
  comment: CommentType;
  onReply?: (parentId: string, content: string) => void;
  onEdit?: (commentId: string, newContent: string) => void;
  onDelete?: (commentId: string) => void;
  depth?: number;
}

export function Comment({ comment, depth = 0, onReply, onEdit, onDelete }: CommentProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const handleReply = (content: string) => {
    onReply?.(comment.id, content);
    setShowReplyInput(false);
  };

  const handleEdit = () => {
    setEditContent(comment.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent.trim() !== comment.content) {
      onEdit?.(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const formattedDate = comment.createdAt
    ? new Date(comment.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      data-testid="comment"
      className={`space-y-2 ${depth > 0 ? 'ml-8 pl-4 border-l border-muted' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          {comment.authorAvatar && <AvatarImage src={comment.authorAvatar} alt={comment.author || 'User'} />}
          <AvatarFallback>{comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{comment.author}</span>
            {comment.authorRole && (
              <Badge variant="outline" className="text-xs">
                {comment.authorRole}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            {comment.isEdited && <span className="text-xs text-muted-foreground italic">(edited)</span>}
          </div>
          {isEditing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-1">{comment.content}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowReplyInput(!showReplyInput)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Reply
            </Button>

            {comment.isOwner && isHovered && !isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleEdit}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => onDelete?.(comment.id)}
                >
                  <Trash className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {showReplyInput && (
        <CommentInput
          onSubmit={handleReply}
          onCancel={() => setShowReplyInput(false)}
          placeholder={`Reply to ${comment.author}...`}
          isNested
          data-testid="nested-reply-input"
        />
      )}
    </div>
  );
}
