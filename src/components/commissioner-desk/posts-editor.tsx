'use client';

import { AlertCircle, FileText, Loader2, Send, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { AutosaveStatus } from './autosave-indicator';

interface PostsEditorProps {
  leagueSlug: string;
  weekNumber: number;
  seasonId: string;
  onSaveStatusChange?: (status: AutosaveStatus) => void;
  onLastSavedChange?: (lastSaved: string) => void;
}

export function PostsEditor({
  leagueSlug,
  weekNumber,
  seasonId,
  onSaveStatusChange,
  onLastSavedChange,
}: PostsEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing draft
  useEffect(() => {
    async function loadDraft() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/desk/posts?leagueSlug=${leagueSlug}&seasonId=${seasonId}&weekNumber=${weekNumber}`
        );

        if (!response.ok) {
          throw new Error('Failed to load draft');
        }

        const data = await response.json();
        const drafts = data.drafts || [];

        if (drafts.length > 0) {
          const draft = drafts[0];
          setTitle(draft.title || '');
          setContent(draft.content || '');
          if (draft.lastSaved) {
            onLastSavedChange?.(draft.lastSaved);
          }
        } else {
          setTitle('');
          setContent('');
        }
      } catch (err) {
        console.error('Error loading post draft:', err);
        setError('Failed to load draft. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadDraft();
  }, [leagueSlug, seasonId, weekNumber, onLastSavedChange]);

  // Autosave function
  const autosave = useCallback(async () => {
    if (!content.trim() && !title.trim()) {
      return;
    }

    onSaveStatusChange?.('saving');
    setIsSaving(true);

    try {
      const response = await fetch('/api/desk/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          leagueSlug,
          seasonId,
          weekNumber,
          title,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      const data = await response.json();
      if (data.lastSaved) {
        onLastSavedChange?.(data.lastSaved);
      }
      onSaveStatusChange?.('saved');
    } catch (err) {
      console.error('Error saving post draft:', err);
      onSaveStatusChange?.('error');
    } finally {
      setIsSaving(false);
    }
  }, [leagueSlug, seasonId, weekNumber, title, content, onSaveStatusChange, onLastSavedChange]);

  // Debounced autosave on content change
  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(autosave, 3000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [title, content, autosave]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    await autosave();
    toast.success('Draft saved');
  }, [autosave]);

  // Publish post
  const handlePublish = useCallback(async () => {
    if (!content.trim()) {
      toast.error('Please write some content before publishing');
      return;
    }

    setIsPublishing(true);

    try {
      const response = await fetch('/api/desk/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          leagueSlug,
          seasonId,
          weekNumber,
          title,
          content,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to publish post');
      }

      // Clear form after successful publish
      setTitle('');
      setContent('');
      onSaveStatusChange?.('idle');

      toast.success('Post published to league feed!');
    } catch (err) {
      console.error('Error publishing post:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setIsPublishing(false);
    }
  }, [leagueSlug, seasonId, weekNumber, title, content, onSaveStatusChange]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="posts-editor">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          League Post
        </CardTitle>
        <CardDescription>
          Create an announcement or update for your league feed. Posts will be visible to all league members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="post-title">Title (optional)</Label>
          <Input
            id="post-title"
            placeholder="Give your post a title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPublishing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-content">Content</Label>
          <Textarea
            id="post-content"
            placeholder="Write your post here... Share league news, updates, trash talk, or any announcement for your members."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPublishing}
            className="min-h-[200px] resize-y"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleSave} disabled={isSaving || isPublishing}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </>
            )}
          </Button>

          <Button onClick={handlePublish} disabled={isPublishing || !content.trim()}>
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Publish to Feed
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Drafts are auto-saved as you type. Published posts appear immediately in the league feed.
        </p>
      </CardContent>
    </Card>
  );
}
