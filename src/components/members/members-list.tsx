'use client';

import { useState } from 'react';

import { ApprovalQueue } from '@/components/members/approval-queue';
import { ChangeRoleDialog } from '@/components/members/change-role-dialog';
import { MemberCard } from '@/components/members/member-card';

import type { LeagueMember, MemberRole } from '@/types/member';

interface MembersListProps {
  leagueSlug: string;
  initialMembers: LeagueMember[];
}

export function MembersList({ leagueSlug, initialMembers }: MembersListProps) {
  const [members, setMembers] = useState(initialMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string;
    role: MemberRole;
  } | null>(null);

  const handleChangeRole = (memberId: string, currentRole: MemberRole) => {
    const member = members.find((m) => m.id === memberId);
    if (member) {
      setSelectedMember({
        id: member.id,
        name: member.name,
        role: currentRole,
      });
      setDialogOpen(true);
    }
  };

  const handleRoleChanged = (memberId: string, newRole: MemberRole) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
  };

  const handleMemberApproved = (memberId: string) => {
    // In a real app, we'd refetch members here
    // For mock, just log it
    console.log('Member approved:', memberId);
  };

  return (
    <div className="space-y-6">
      {/* Approval Queue (fetches pending members client-side for testability) */}
      <ApprovalQueue leagueSlug={leagueSlug} onMemberApproved={handleMemberApproved} />

      {/* Members List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          All Members <span className="text-muted-foreground">({members.length})</span>
        </h2>
        <div className="grid gap-3">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} canManageRoles onChangeRole={handleChangeRole} />
          ))}
        </div>
      </div>

      {/* Change Role Dialog */}
      {selectedMember && (
        <ChangeRoleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          leagueSlug={leagueSlug}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          currentRole={selectedMember.role}
          onRoleChanged={handleRoleChanged}
        />
      )}
    </div>
  );
}
