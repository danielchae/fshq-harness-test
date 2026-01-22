'use client';

import { Loader2, Send } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import type { Moment } from '@/types/feed';

const MAX_CHARACTERS = 5000;

interface PostComposerProps {
  leagueSlug: string;
  onPostCreated?: (moment: Moment) => void;
  authorName?: string;
  authorAvatar?: string;
}

export function PostComposer({
  leagueSlug,
  onPostCreated,
  authorName = 'Current User',
  authorAvatar,
}: PostComposerProps) {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remainingChars = MAX_CHARACTERS - content.length;
  const isValid = content.trim().length > 0;
  const isOverLimit = remainingChars < 0;

  const handleClick = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
      // Focus the textarea after expansion
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [isExpanded]);

  const handleFocus = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  const handleBlur = useCallback(() => {
    if (!isValid && content.length === 0) {
      setShowValidation(true);
    }
  }, [isValid, content.length]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setShowValidation(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid || isOverLimit || isSubmitting) return;

    setIsSubmitting(true);

    // Create optimistic moment
    const optimisticMoment: Moment = {
      id: `optimistic-${Date.now()}`,
      type: 'post',
      content: content.trim(),
      createdAt: new Date().toISOString(),
      authorName,
      authorAvatar,
      reactions: {},
      commentCount: 0,
    };

    // Optimistically add to feed
    onPostCreated?.(optimisticMoment);

    try {
      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueSlug,
          content: content.trim(),
          authorName,
          authorAvatar,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create post');
      }

      // Clear the form on success
      setContent('');
      setIsExpanded(false);
      setShowValidation(false);
      toast.success('Post published successfully!');
    } catch (error) {
      // Keep the content for retry
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
      // Remove the optimistic moment on failure (handled by parent through re-fetch or state)
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, isOverLimit, isSubmitting, content, authorName, authorAvatar, leagueSlug, onPostCreated]);

  return (
    <Card data-testid="post-composer" className="mb-4 border-dashed">
      <CardContent className="p-4">
        <div
          className="flex gap-3"
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
          role="button"
          tabIndex={isExpanded ? -1 : 0}
          aria-label="Expand post composer"
        >
          <Avatar className="h-10 w-10 flex-shrink-0">
            {authorAvatar && <AvatarImage src={authorAvatar} alt={authorName} />}
            <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <Textarea
              ref={textareaRef}
              aria-label="Compose post"
              placeholder="What's happening in your league?"
              value={content}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={isSubmitting}
              className={`min-h-[40px] resize-none transition-all ${
                isExpanded ? 'min-h-[100px]' : ''
              } ${isOverLimit ? 'border-destructive' : ''}`}
            />

            {isExpanded && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    data-testid="char-count"
                    className={`text-sm ${
                      isOverLimit
                        ? 'text-destructive font-medium'
                        : remainingChars < 100
                          ? 'text-warning'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {isOverLimit ? '⚠ ' : remainingChars < 100 ? '⚠ ' : ''}
                    {remainingChars} remaining
                  </span>
                  {showValidation && !isValid && (
                    <span data-testid="validation-error" className="text-sm text-destructive">
                      Post cannot be empty
                    </span>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || isOverLimit || isSubmitting}
                  size="sm"
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Post
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
