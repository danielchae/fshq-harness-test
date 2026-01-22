'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import type { TeamRanking } from '@/data/power-rankings/get-power-rankings';

interface RankingsPreviewModalProps {
  open: boolean;
  onClose: () => void;
  rankings: TeamRanking[];
  weekNumber: number;
}

export function RankingsPreviewModal({ open, onClose, rankings, weekNumber }: RankingsPreviewModalProps) {
  const getRankChange = (ranking: TeamRanking) => {
    if (!ranking.previousRank) return null;
    const change = ranking.previousRank - ranking.rank;
    if (change > 0) return <span className="text-green-500 text-sm font-medium">↑{change}</span>;
    if (change < 0) return <span className="text-red-500 text-sm font-medium">↓{Math.abs(change)}</span>;
    return <span className="text-muted-foreground text-sm">—</span>;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        aria-labelledby="preview-dialog-title"
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle id="preview-dialog-title">Power Rankings Preview - Week {weekNumber}</DialogTitle>
          <DialogDescription>This is how league members will see your power rankings.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-amber-100 border border-amber-200 rounded-md p-3 mb-4">
            <p className="text-sm text-amber-800 font-medium">Preview Mode - Not Yet Published</p>
          </div>

          <div className="space-y-3">
            {rankings.map((ranking) => {
              const recordText = `${ranking.record.wins}-${ranking.record.losses}${ranking.record.ties > 0 ? `-${ranking.record.ties}` : ''}`;

              return (
                <Card key={ranking.id} data-testid="preview-ranking-card" className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className="flex flex-col items-center gap-1 min-w-[50px]">
                      <span data-testid="rank-number" className="text-3xl font-bold text-primary">
                        {ranking.rank}
                      </span>
                      {getRankChange(ranking)}
                    </div>

                    {/* Team info */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={ranking.avatarUrl} alt={ranking.teamName} />
                        <AvatarFallback>{ranking.teamName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span data-testid="team-name" className="font-semibold text-lg">
                          {ranking.teamName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {ranking.ownerUsername} • {recordText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Commentary */}
                  {ranking.commentary && (
                    <div className="mt-3 pt-3 border-t">
                      <p data-testid="team-commentary" className="text-sm text-muted-foreground italic">
                        &quot;{ranking.commentary}&quot;
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
