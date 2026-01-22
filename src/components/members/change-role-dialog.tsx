'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { MemberRole } from '@/types/member';

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueSlug: string;
  memberId: string;
  memberName: string;
  currentRole: MemberRole;
  onRoleChanged?: (memberId: string, newRole: MemberRole) => void;
}

const roleOptions: { value: MemberRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Can manage settings and members' },
  { value: 'manager', label: 'Manager', description: 'Can manage their team' },
  { value: 'fan', label: 'Fan', description: 'Can view and participate' },
];

export function ChangeRoleDialog({
  open,
  onOpenChange,
  leagueSlug,
  memberId,
  memberName,
  currentRole,
  onRoleChanged,
}: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<MemberRole>(currentRole);
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter out commissioner (can't be assigned) and current role
  const availableRoles = roleOptions.filter((r) => r.value !== 'commissioner');

  const handleConfirm = async () => {
    if (selectedRole === currentRole) {
      onOpenChange(false);
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, newRole: selectedRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      onRoleChanged?.(memberId, selectedRole);
      onOpenChange(false);

      toast.success('Role updated', {
        description: `${memberName} is now a ${selectedRole}.`,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Role for {memberName}</AlertDialogTitle>
          <AlertDialogDescription>
            Select a new role for this member. This will change their permissions in the league.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as MemberRole)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  <div className="flex flex-col">
                    <span>{role.label}</span>
                    <span className="text-xs text-muted-foreground">{role.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isUpdating || selectedRole === currentRole}>
            {isUpdating ? 'Updating...' : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
