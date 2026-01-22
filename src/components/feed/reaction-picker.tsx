'use client';

import { SmilePlus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Common reaction emojis
const REACTION_EMOJIS = [
  { emoji: '👍', label: 'thumbs up' },
  { emoji: '❤️', label: 'heart' },
  { emoji: '🔥', label: 'fire' },
  { emoji: '😂', label: 'laughing' },
  { emoji: '😮', label: 'surprised' },
  { emoji: '😢', label: 'sad' },
  { emoji: '🎉', label: 'celebration' },
  { emoji: '👀', label: 'eyes' },
];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function ReactionPicker({ onSelect, disabled = false }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="gap-1 text-muted-foreground hover:text-foreground"
          aria-label="Add reaction"
        >
          <SmilePlus className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:inline">React</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent data-testid="reaction-picker" className="w-auto p-2" align="start" sideOffset={4}>
        <div className="flex flex-wrap gap-1">
          {REACTION_EMOJIS.map(({ emoji, label }) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 text-lg hover:bg-muted"
              onClick={() => handleSelect(emoji)}
              aria-label={label}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
