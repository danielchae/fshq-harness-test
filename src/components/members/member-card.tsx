'use client';

import { Crown, Shield, ShieldCheck, User } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import type { LeagueMember, MemberRole } from '@/types/member';

interface MemberCardProps {
  member: LeagueMember;
  onChangeRole?: (memberId: string, currentRole: MemberRole) => void;
  canManageRoles?: boolean;
}

const roleConfig: Record<
  MemberRole,
  { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' }
> = {
  commissioner: {
    label: 'Commissioner',
    icon: <Crown className="h-3 w-3" />,
    variant: 'default',
  },
  admin: {
    label: 'Admin',
    icon: <ShieldCheck className="h-3 w-3" />,
    variant: 'default',
  },
  manager: {
    label: 'Manager',
    icon: <Shield className="h-3 w-3" />,
    variant: 'secondary',
  },
  fan: {
    label: 'Fan',
    icon: <User className="h-3 w-3" />,
    variant: 'outline',
  },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function MemberCard({ member, onChangeRole, canManageRoles = false }: MemberCardProps) {
  const { label, icon, variant } = roleConfig[member.role];

  return (
    <Card data-testid="member-card" className="py-4">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <Avatar data-testid="member-avatar" className="h-10 w-10">
            <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span data-testid="member-name" className="font-medium">
              {member.name}
            </span>
            {member.teamName && <span className="text-sm text-muted-foreground">{member.teamName}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 pl-13 sm:pl-0">
          <Badge data-testid="role-badge" variant={variant} className="gap-1">
            {icon}
            {label}
          </Badge>
          {canManageRoles && member.role !== 'commissioner' && (
            <Button
              data-testid="change-role-button"
              variant="outline"
              size="sm"
              onClick={() => onChangeRole?.(member.id, member.role)}
            >
              Change Role
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
