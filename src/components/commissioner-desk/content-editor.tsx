'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ContentEditorProps {
  type: 'power-rankings' | 'matchup-predictions' | 'posts';
  initialContent?: string;
  onContentChange: (content: string) => void;
}

const editorConfig = {
  'power-rankings': {
    title: 'Power Rankings Editor',
    placeholder: 'Create your weekly power rankings. Drag teams to reorder, add commentary for each team...',
    testId: 'rankings-editor',
  },
  'matchup-predictions': {
    title: 'Matchup Predictions Editor',
    placeholder: 'Add your matchup predictions for the week. Select matchups and add your analysis...',
    testId: 'matchup-editor',
  },
  posts: {
    title: 'Posts Editor',
    placeholder: 'Create a post for the league feed. Share news, updates, or commentary...',
    testId: 'posts-editor',
  },
};

export function ContentEditor({ type, initialContent = '', onContentChange }: ContentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const config = editorConfig[type];

  const handleChange = useCallback(
    (newContent: string) => {
      setContent(newContent);

      // Debounce content change callback
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onContentChange(newContent);
      }, 300);
    },
    [onContentChange]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Card data-testid={config.testId}>
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="textbox"
          contentEditable
          className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onInput={(e) => handleChange(e.currentTarget.textContent || '')}
          suppressContentEditableWarning
          data-placeholder={config.placeholder}
        >
          {content}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{config.placeholder}</p>
      </CardContent>
    </Card>
  );
}
