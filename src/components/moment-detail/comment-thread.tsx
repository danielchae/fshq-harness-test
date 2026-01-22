'use client';

import { useMemo } from 'react';

import { Comment } from './comment';

import type { Comment as CommentType } from '@/types/feed';

interface CommentThreadProps {
  comments: CommentType[];
  onReply: (parentId: string, content: string) => void;
  onEdit: (commentId: string, newContent: string) => void;
  onDelete: (commentId: string) => void;
}

interface ThreadedComment extends CommentType {
  children: ThreadedComment[];
}

function buildCommentTree(comments: CommentType[]): ThreadedComment[] {
  const commentMap = new Map<string, ThreadedComment>();
  const roots: ThreadedComment[] = [];

  // Create threaded versions of all comments
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, children: [] });
  });

  // Build the tree structure
  comments.forEach((comment) => {
    const threadedComment = commentMap.get(comment.id)!;
    if (comment.parentId && commentMap.has(comment.parentId)) {
      const parent = commentMap.get(comment.parentId)!;
      parent.children.push(threadedComment);
    } else {
      roots.push(threadedComment);
    }
  });

  return roots;
}

function renderCommentTree(
  comments: ThreadedComment[],
  depth: number,
  handlers: {
    onReply: (parentId: string, content: string) => void;
    onEdit: (commentId: string, newContent: string) => void;
    onDelete: (commentId: string) => void;
  }
): React.ReactNode {
  return comments.map((comment) => (
    <div key={comment.id} className="space-y-3">
      <Comment comment={comment} depth={depth} {...handlers} />
      {comment.children.length > 0 && (
        <div className="space-y-3">{renderCommentTree(comment.children, depth + 1, handlers)}</div>
      )}
    </div>
  ));
}

export function CommentThread({ comments, onReply, onEdit, onDelete }: CommentThreadProps) {
  const threadedComments = useMemo(() => buildCommentTree(comments), [comments]);

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Be the first to comment!</p>
      </div>
    );
  }

  return <div className="space-y-4">{renderCommentTree(threadedComments, 0, { onReply, onEdit, onDelete })}</div>;
}
