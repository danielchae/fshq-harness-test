'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CommentInputProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  isNested?: boolean;
  onCancel?: () => void;
  'data-testid'?: string;
}

export function CommentInput({
  onSubmit,
  placeholder = 'Write a comment...',
  isNested = false,
  onCancel,
  'data-testid': testId,
}: CommentInputProps) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent('');
    }
  };

  return (
    <div className={`space-y-2 ${isNested ? 'ml-8' : ''}`} data-testid={testId}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        aria-label={isNested ? 'Reply to comment' : 'Write a comment'}
        className="min-h-[80px] resize-none"
      />
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
          {isNested ? 'Post Reply' : 'Post Comment'}
        </Button>
      </div>
    </div>
  );
}
