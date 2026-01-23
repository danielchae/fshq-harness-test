'use client';

import { ArrowDownUp, ArrowRight, Clock, Minus, Plus, RefreshCw, UserMinus } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import type { Transaction } from '@/types/transactions';

interface TransactionCardProps {
  transaction: Transaction;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffDays < 7) {
    return `${Math.floor(diffDays)}d ago`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getTransactionTypeLabel(type: Transaction['type']): string {
  switch (type) {
    case 'trade':
      return 'Trade';
    case 'waiver':
      return 'Waiver Claim';
    case 'free_agent':
      return 'Free Agent';
    case 'drop':
      return 'Drop';
    default:
      return 'Transaction';
  }
}

function getTransactionTypeVariant(type: Transaction['type']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'trade':
      return 'default';
    case 'waiver':
      return 'secondary';
    case 'free_agent':
      return 'outline';
    case 'drop':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getTransactionIcon(type: Transaction['type']) {
  switch (type) {
    case 'trade':
      return <ArrowDownUp className="h-4 w-4" />;
    case 'waiver':
      return <Clock className="h-4 w-4" />;
    case 'free_agent':
      return <RefreshCw className="h-4 w-4" />;
    case 'drop':
      return <UserMinus className="h-4 w-4" />;
    default:
      return null;
  }
}

function TradeCard({ transaction }: { transaction: Transaction & { type: 'trade' } }) {
  return (
    <div className="space-y-4" data-type="trade">
      {transaction.teams.map((team, idx) => (
        <div key={team.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={team.avatarUrl} alt={team.name} />
              <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-medium" data-testid="team-name">
              {team.name}
            </span>
          </div>
          <div className="ml-10 space-y-2 text-sm">
            {team.playersOut && team.playersOut.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Minus className="h-3 w-3 text-red-500 flex-shrink-0" />
                  <span>Traded away:</span>
                </div>
                <div className="ml-5 space-y-0.5">
                  {team.playersOut.map((asset, assetIdx) => (
                    <div
                      key={`${asset}-${assetIdx}`}
                      className="font-medium text-foreground"
                      data-testid="player-name"
                      data-player
                    >
                      {asset}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {team.playersIn && team.playersIn.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Plus className="h-3 w-3 text-green-500 flex-shrink-0" />
                  <span>Received:</span>
                </div>
                <div className="ml-5 space-y-0.5">
                  {team.playersIn.map((asset, assetIdx) => (
                    <div
                      key={`${asset}-${assetIdx}`}
                      className="font-medium text-foreground"
                      data-testid="player-name"
                      data-player
                    >
                      {asset}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {idx < transaction.teams.length - 1 && (
            <div className="flex justify-center py-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WaiverCard({ transaction }: { transaction: Transaction & { type: 'waiver' } }) {
  return (
    <div className="space-y-3" data-type="waiver">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={transaction.team.avatarUrl} alt={transaction.team.name} />
          <AvatarFallback>{transaction.team.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="font-medium" data-testid="team-name">
          {transaction.team.name}
        </span>
        {transaction.faabAmount !== undefined && (
          <Badge variant="outline" className="ml-auto">
            ${transaction.faabAmount} FAAB
          </Badge>
        )}
        {transaction.waiverPriority !== undefined && (
          <Badge variant="outline" className="ml-auto">
            Priority #{transaction.waiverPriority}
          </Badge>
        )}
      </div>
      <div className="ml-10 space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <Plus className="h-3 w-3 text-green-500" />
          <span className="text-muted-foreground">Claimed:</span>
          <span className="font-medium" data-testid="player-name">
            {transaction.playerAdded}
          </span>
          {transaction.playerAddedDetails && (
            <span className="text-muted-foreground">
              ({transaction.playerAddedDetails.position} - {transaction.playerAddedDetails.nflTeam})
            </span>
          )}
        </div>
        {transaction.playerDropped && (
          <div className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-red-500" />
            <span className="text-muted-foreground">Dropped:</span>
            <span className="font-medium" data-testid="player-name">
              {transaction.playerDropped}
            </span>
            {transaction.playerDroppedDetails && (
              <span className="text-muted-foreground">
                ({transaction.playerDroppedDetails.position} - {transaction.playerDroppedDetails.nflTeam})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FreeAgentCard({ transaction }: { transaction: Transaction & { type: 'free_agent' } }) {
  return (
    <div className="space-y-3" data-type="free_agent">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={transaction.team.avatarUrl} alt={transaction.team.name} />
          <AvatarFallback>{transaction.team.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="font-medium" data-testid="team-name">
          {transaction.team.name}
        </span>
      </div>
      <div className="ml-10 space-y-1 text-sm">
        {transaction.playerAdded && (
          <div className="flex items-center gap-2">
            <Plus className="h-3 w-3 text-green-500" />
            <span className="text-muted-foreground">Added:</span>
            <span className="font-medium" data-testid="player-name">
              {transaction.playerAdded}
            </span>
            {transaction.playerAddedDetails && (
              <span className="text-muted-foreground">
                ({transaction.playerAddedDetails.position} - {transaction.playerAddedDetails.nflTeam})
              </span>
            )}
          </div>
        )}
        {transaction.playerDropped && (
          <div className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-red-500" />
            <span className="text-muted-foreground">Dropped:</span>
            <span className="font-medium" data-testid="player-name">
              {transaction.playerDropped}
            </span>
            {transaction.playerDroppedDetails && (
              <span className="text-muted-foreground">
                ({transaction.playerDroppedDetails.position} - {transaction.playerDroppedDetails.nflTeam})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DropCard({ transaction }: { transaction: Transaction & { type: 'drop' } }) {
  return (
    <div className="space-y-3" data-type="drop">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={transaction.team.avatarUrl} alt={transaction.team.name} />
          <AvatarFallback>{transaction.team.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="font-medium" data-testid="team-name">
          {transaction.team.name}
        </span>
      </div>
      <div className="ml-10 text-sm">
        <div className="flex items-center gap-2">
          <Minus className="h-3 w-3 text-red-500" />
          <span className="text-muted-foreground">Released:</span>
          <span className="font-medium" data-testid="player-name">
            {transaction.playerDropped}
          </span>
          {transaction.playerDroppedDetails && (
            <span className="text-muted-foreground">
              ({transaction.playerDroppedDetails.position} - {transaction.playerDroppedDetails.nflTeam})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TransactionCard({ transaction }: TransactionCardProps) {
  return (
    <Card data-testid="transaction-card" data-type={transaction.type}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTransactionIcon(transaction.type)}
            <Badge variant={getTransactionTypeVariant(transaction.type)}>
              {getTransactionTypeLabel(transaction.type)}
            </Badge>
          </div>
          <span
            className="text-sm text-muted-foreground"
            data-testid="transaction-date"
            data-timestamp={transaction.timestamp}
          >
            {formatDate(transaction.timestamp)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {transaction.type === 'trade' && <TradeCard transaction={transaction} />}
        {transaction.type === 'waiver' && <WaiverCard transaction={transaction} />}
        {transaction.type === 'free_agent' && <FreeAgentCard transaction={transaction} />}
        {transaction.type === 'drop' && <DropCard transaction={transaction} />}
      </CardContent>
    </Card>
  );
}
