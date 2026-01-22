'use client';

import { GripVertical } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import type { TeamRanking } from '@/data/power-rankings/get-power-rankings';

interface RankingRowProps {
  ranking: TeamRanking;
  onCommentaryChange: (teamId: string, commentary: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
}

export function RankingRow({
  ranking,
  onCommentaryChange,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDragOver,
  onDrop,
  index,
  isDragging,
  isDropTarget,
}: RankingRowProps) {
  const recordText = `${ranking.record.wins}-${ranking.record.losses}${ranking.record.ties > 0 ? `-${ranking.record.ties}` : ''}`;

  const getRankChange = () => {
    if (!ranking.previousRank) return null;
    const change = ranking.previousRank - ranking.rank;
    if (change > 0) return <span className="text-green-500 text-xs">↑{change}</span>;
    if (change < 0) return <span className="text-red-500 text-xs">↓{Math.abs(change)}</span>;
    return <span className="text-muted-foreground text-xs">—</span>;
  };

  return (
    <Card
      data-testid="ranking-row"
      draggable="true"
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnter={(e) => onDragEnter(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className={`p-4 transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isDropTarget ? 'border-primary border-2 bg-primary/5' : ''}`}
    >
      <div className="flex items-start gap-4">
        {/* Drag handle */}
        <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing pt-1">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Rank number */}
        <div className="flex flex-col items-center gap-1 min-w-[40px]">
          <span data-testid="rank-number" className="text-2xl font-bold text-primary">
            {ranking.rank}
          </span>
          {getRankChange()}
        </div>

        {/* Team info */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <Avatar className="h-10 w-10">
            <AvatarImage src={ranking.avatarUrl} alt={ranking.teamName} />
            <AvatarFallback>{ranking.teamName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span data-testid="team-name" className="font-semibold">
              {ranking.teamName}
            </span>
            <span className="text-sm text-muted-foreground">
              {ranking.ownerUsername} • {recordText}
            </span>
          </div>
        </div>

        {/* Commentary textarea */}
        <div className="flex-1">
          <Textarea
            aria-label="Commentary"
            placeholder="Add commentary for this team's ranking..."
            value={ranking.commentary}
            onChange={(e) => onCommentaryChange(ranking.teamId, e.target.value)}
            className="min-h-[80px] resize-none"
            rows={2}
          />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>Recommended: 50-500 characters</span>
            <span>{ranking.commentary.length} characters</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
