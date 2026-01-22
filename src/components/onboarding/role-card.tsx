'use client';

import { cn } from '@/lib/utils';

export interface RoleCardProps {
  role: 'manager' | 'fan';
  title: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}

export function RoleCard({ role, title, description, icon, isSelected, onSelect }: RoleCardProps) {
  return (
    <button
      type="button"
      data-testid={`role-card-${role}`}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border-2 p-6 text-left transition-all hover:border-primary/50 hover:bg-accent/50',
        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card'
      )}
    >
      <div
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full',
          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {icon}
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p data-testid="role-description" className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}
