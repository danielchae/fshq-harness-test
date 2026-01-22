'use client';

import { Star } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import type { MatchupPrediction } from '@/data/matchup-predictions/get-matchup-predictions';

interface MatchupPreviewModalProps {
  open: boolean;
  onClose: () => void;
  predictions: MatchupPrediction[];
  weekNumber: number;
}

export function MatchupPreviewModal({ open, onClose, predictions, weekNumber }: MatchupPreviewModalProps) {
  const featuredPrediction = predictions.find((p) => p.isFeatured);

  const formatRecord = (record: { wins: number; losses: number; ties: number }) => {
    return `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        aria-labelledby="preview-dialog-title"
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle id="preview-dialog-title">Matchup Predictions Preview - Week {weekNumber}</DialogTitle>
          <DialogDescription>This is how league members will see your matchup predictions.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-amber-100 border border-amber-200 rounded-md p-3 mb-4">
            <p className="text-sm text-amber-800 font-medium">Preview Mode - Not Yet Published</p>
          </div>

          {/* Featured matchup */}
          {featuredPrediction && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Star className="h-5 w-5 text-primary fill-primary" />
                Matchup of the Week
              </h3>
              <Card
                data-testid="featured-matchup"
                data-featured="true"
                className="p-6 border-primary ring-2 ring-primary"
              >
                <div className="flex items-center justify-between gap-6 mb-4">
                  {/* Home team */}
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={featuredPrediction.homeTeam.avatarUrl} alt={featuredPrediction.homeTeam.name} />
                      <AvatarFallback className="text-lg">
                        {featuredPrediction.homeTeam.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-lg text-center">{featuredPrediction.homeTeam.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatRecord(featuredPrediction.homeTeam.record)}
                    </span>
                  </div>

                  {/* VS */}
                  <div className="text-2xl font-bold text-muted-foreground">VS</div>

                  {/* Away team */}
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={featuredPrediction.awayTeam.avatarUrl} alt={featuredPrediction.awayTeam.name} />
                      <AvatarFallback className="text-lg">
                        {featuredPrediction.awayTeam.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-lg text-center">{featuredPrediction.awayTeam.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatRecord(featuredPrediction.awayTeam.record)}
                    </span>
                  </div>
                </div>

                {/* Hype text */}
                {featuredPrediction.hypeText && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-muted-foreground italic leading-relaxed">
                      &quot;{featuredPrediction.hypeText}&quot;
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Other matchups */}
          <div className="space-y-3">
            <h3 className="text-md font-semibold">Other Matchups</h3>
            {predictions
              .filter((p) => !p.isFeatured)
              .map((prediction) => (
                <Card key={prediction.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Home team */}
                    <div className="flex-1 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={prediction.homeTeam.avatarUrl} alt={prediction.homeTeam.name} />
                        <AvatarFallback>{prediction.homeTeam.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-sm truncate">{prediction.homeTeam.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRecord(prediction.homeTeam.record)}
                        </span>
                      </div>
                    </div>

                    {/* VS */}
                    <div className="text-sm font-medium text-muted-foreground">vs</div>

                    {/* Away team */}
                    <div className="flex-1 flex items-center gap-2 justify-end">
                      <div className="flex flex-col items-end min-w-0">
                        <span className="font-medium text-sm truncate">{prediction.awayTeam.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRecord(prediction.awayTeam.record)}
                        </span>
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={prediction.awayTeam.avatarUrl} alt={prediction.awayTeam.name} />
                        <AvatarFallback>{prediction.awayTeam.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>

                  {/* Hype text if present */}
                  {prediction.hypeText && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground italic line-clamp-2">
                        &quot;{prediction.hypeText}&quot;
                      </p>
                    </div>
                  )}
                </Card>
              ))}
          </div>

          {!featuredPrediction && predictions.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No matchups available for this week.</p>
          )}
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
