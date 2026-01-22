import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
