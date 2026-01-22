'use client';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

// Custom hook for swipe gesture support
function useSwipeGesture(side: 'left' | 'right' | 'top' | 'bottom', onSwipeClose: () => void) {
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD = 50;

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }
  }, []);

  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      const touchEnd = {
        x: touch.clientX,
        y: touch.clientY,
      };

      const deltaX = touchStartRef.current.x - touchEnd.x;
      const deltaY = touchStartRef.current.y - touchEnd.y;

      // Only handle horizontal swipes for left/right sheets
      if (side === 'left' && deltaX > SWIPE_THRESHOLD && Math.abs(deltaY) < Math.abs(deltaX)) {
        onSwipeClose();
      } else if (side === 'right' && deltaX < -SWIPE_THRESHOLD && Math.abs(deltaY) < Math.abs(deltaX)) {
        onSwipeClose();
      } else if (side === 'top' && deltaY > SWIPE_THRESHOLD && Math.abs(deltaX) < Math.abs(deltaY)) {
        onSwipeClose();
      } else if (side === 'bottom' && deltaY < -SWIPE_THRESHOLD && Math.abs(deltaX) < Math.abs(deltaY)) {
        onSwipeClose();
      }

      touchStartRef.current = null;
    },
    [side, onSwipeClose]
  );

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = React.useCallback(
    (e: React.MouseEvent) => {
      if (!touchStartRef.current) return;

      const deltaX = touchStartRef.current.x - e.clientX;
      const deltaY = touchStartRef.current.y - e.clientY;

      if (side === 'left' && deltaX > SWIPE_THRESHOLD && Math.abs(deltaY) < Math.abs(deltaX)) {
        onSwipeClose();
      } else if (side === 'right' && deltaX < -SWIPE_THRESHOLD && Math.abs(deltaY) < Math.abs(deltaX)) {
        onSwipeClose();
      }

      touchStartRef.current = null;
    },
    [side, onSwipeClose]
  );

  return { handleTouchStart, handleTouchEnd, handleMouseDown, handleMouseUp };
}

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  onSwipeClose,
  'data-testid': dataTestId,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  onSwipeClose?: () => void;
  'data-testid'?: string;
}) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  const handleSwipeClose = React.useCallback(() => {
    if (onSwipeClose) {
      onSwipeClose();
    } else {
      // Trigger the close button as fallback
      closeButtonRef.current?.click();
    }
  }, [onSwipeClose]);

  const { handleTouchStart, handleTouchEnd, handleMouseDown, handleMouseUp } = useSwipeGesture(side, handleSwipeClose);

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-testid={dataTestId}
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
          side === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
          side === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          ref={closeButtonRef}
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
