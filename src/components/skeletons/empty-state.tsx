'use client';

import { FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon: Icon = FileQuestion, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}
    >
      <div data-testid="empty-illustration" className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 data-testid="empty-title" className="text-lg font-semibold mb-2">
        {title}
      </h3>
      <p data-testid="empty-description" className="text-muted-foreground text-sm max-w-md mb-6">
        {description}
      </p>
      {action && (
        <Button data-testid="empty-cta" variant={action.variant || 'default'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
