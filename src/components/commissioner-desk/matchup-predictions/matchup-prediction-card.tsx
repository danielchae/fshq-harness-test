'use client';

import { Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { MatchupPrediction } from '@/data/matchup-predictions/get-matchup-predictions';

interface MatchupPredictionCardProps {
  prediction: MatchupPrediction;
  onFeatureToggle: (matchupId: string) => void;
  onHypeTextChange: (matchupId: string, hypeText: string) => void;
}

export function MatchupPredictionCard({ prediction, onFeatureToggle, onHypeTextChange }: MatchupPredictionCardProps) {
  const [localHypeText, setLocalHypeText] = useState(prediction.hypeText);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Update local state when prediction changes (e.g., after reload)
  useEffect(() => {
    setLocalHypeText(prediction.hypeText);
  }, [prediction.hypeText]);

  const handleHypeTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setLocalHypeText(newText);

      // Debounce the callback to parent
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onHypeTextChange(prediction.matchupId, newText);
      }, 500);
    },
    [prediction.matchupId, onHypeTextChange]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const formatRecord = (record: { wins: number; losses: number; ties: number }) => {
    return `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}`;
  };

  return (
    <Card
      data-testid="matchup-prediction-card"
      data-featured={prediction.isFeatured || undefined}
      className={cn('transition-all duration-200', prediction.isFeatured && 'ring-2 ring-primary border-primary')}
    >
      <CardContent className="p-4">
        {/* Teams display */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Home team */}
          <div className="flex-1 flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={prediction.homeTeam.avatarUrl} alt={prediction.homeTeam.name} />
              <AvatarFallback>{prediction.homeTeam.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span data-testid="team-name" className="font-semibold truncate">
                {prediction.homeTeam.name}
              </span>
              <span className="text-sm text-muted-foreground">{formatRecord(prediction.homeTeam.record)}</span>
            </div>
          </div>

          {/* VS separator */}
          <div className="text-lg font-bold text-muted-foreground">vs</div>

          {/* Away team */}
          <div className="flex-1 flex items-center gap-3 justify-end">
            <div className="flex flex-col items-end min-w-0">
              <span data-testid="team-name" className="font-semibold truncate">
                {prediction.awayTeam.name}
              </span>
              <span className="text-sm text-muted-foreground">{formatRecord(prediction.awayTeam.record)}</span>
            </div>
            <Avatar className="h-10 w-10">
              <AvatarImage src={prediction.awayTeam.avatarUrl} alt={prediction.awayTeam.name} />
              <AvatarFallback>{prediction.awayTeam.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Feature toggle */}
        <div className="flex items-center justify-between py-3 border-t border-b">
          <div className="flex items-center gap-2">
            <Label htmlFor={`feature-switch-${prediction.matchupId}`} className="text-sm font-medium cursor-pointer">
              Feature this matchup
            </Label>
            {prediction.isFeatured && (
              <span
                data-testid="featured-indicator"
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
              >
                <Star className="h-3 w-3 fill-current" />
                Featured
              </span>
            )}
          </div>
          <Switch
            id={`feature-switch-${prediction.matchupId}`}
            checked={prediction.isFeatured}
            onCheckedChange={() => onFeatureToggle(prediction.matchupId)}
            aria-label="Feature this matchup"
          />
        </div>

        {/* Hype text / prediction textarea */}
        <div className="mt-4 space-y-2">
          <Label htmlFor={`hype-text-${prediction.matchupId}`} className="text-sm font-medium">
            Hype text / Prediction
          </Label>
          <Textarea
            id={`hype-text-${prediction.matchupId}`}
            aria-label="Hype text or prediction"
            placeholder="Add your prediction or hype text for this matchup..."
            value={localHypeText}
            onChange={handleHypeTextChange}
            className="min-h-[80px] resize-none"
            maxLength={2000}
          />
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground">{localHypeText.length}/2000 characters</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
