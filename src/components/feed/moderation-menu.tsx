'use client';

import { EyeOff, MoreVertical, Pin, PinOff, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ModerationMenuProps {
  momentId: string;
  isPinned?: boolean;
  isHidden?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  onHide?: () => void;
  onDelete?: () => void;
}

export function ModerationMenu({ isPinned = false, onPin, onUnpin, onHide, onDelete }: ModerationMenuProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (isPinned) {
        onUnpin?.();
      } else {
        onPin?.();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleHide = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      onHide?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      onDelete?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10" data-testid="moderation-menu" disabled={isLoading}>
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open moderation menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePin} disabled={isLoading}>
          {isPinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              Unpin
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              Pin to Top
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleHide} disabled={isLoading}>
          <EyeOff className="mr-2 h-4 w-4" />
          Hide
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} disabled={isLoading} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
