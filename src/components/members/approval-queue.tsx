'use client';

import { Check, Clock, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { PendingMember } from '@/types/member';

interface ApprovalQueueProps {
  leagueSlug: string;
  onMemberApproved?: (memberId: string) => void;
  onMemberDenied?: (memberId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ApprovalQueue({ leagueSlug, onMemberApproved, onMemberDenied }: ApprovalQueueProps) {
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Fetch pending members on mount (client-side for testability)
  useEffect(() => {
    const fetchPendingMembers = async () => {
      try {
        const response = await fetch(`/api/leagues/${leagueSlug}/members/pending`);
        if (response.ok) {
          const data = await response.json();
          setPendingMembers(data);
        }
      } catch (error) {
        console.error('Error fetching pending members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingMembers();
  }, [leagueSlug]);

  const handleApprove = async (memberId: string) => {
    setProcessingIds((prev) => new Set(prev).add(memberId));

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/members/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingMemberId: memberId, action: 'approve' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve member');
      }

      // Remove from pending list
      setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
      onMemberApproved?.(memberId);

      toast.success('Member approved', {
        description: 'The member now has access to the league.',
      });
    } catch (error) {
      console.error('Error approving member:', error);
      toast.error('Failed to approve member');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  const handleDeny = async (memberId: string) => {
    setProcessingIds((prev) => new Set(prev).add(memberId));

    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/members/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingMemberId: memberId, action: 'deny' }),
      });

      if (!response.ok) {
        throw new Error('Failed to deny member');
      }

      // Remove from pending list
      setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
      onMemberDenied?.(memberId);

      toast.success('Request denied', {
        description: 'The membership request has been denied.',
      });
    } catch (error) {
      console.error('Error denying member:', error);
      toast.error('Failed to deny request');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  // Don't render anything while loading or if no pending members
  if (isLoading) {
    return null;
  }

  if (pendingMembers.length === 0) {
    return null;
  }

  return (
    <Card data-testid="approval-queue" className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
            <CardDescription>
              {pendingMembers.length} {pendingMembers.length === 1 ? 'request' : 'requests'} waiting for review
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingMembers.map((member) => {
          const isProcessing = processingIds.has(member.id);
          return (
            <div
              key={member.id}
              data-testid="pending-member"
              className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
                  <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-sm text-muted-foreground">{member.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-12 sm:pl-0">
                <Button
                  data-testid="approve-button"
                  size="sm"
                  onClick={() => handleApprove(member.id)}
                  disabled={isProcessing}
                  className="gap-1"
                >
                  {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Approve
                </Button>
                <Button
                  data-testid="deny-button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeny(member.id)}
                  disabled={isProcessing}
                  className="gap-1"
                >
                  <X className="h-3 w-3" />
                  Deny
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
