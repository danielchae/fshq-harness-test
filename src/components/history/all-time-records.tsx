'use client';

import { Award, Star, Target, TrendingUp, Trophy } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { AllTimeRecord } from '@/types/history';

interface AllTimeRecordsProps {
  records: AllTimeRecord[];
}

const iconMap: Record<AllTimeRecord['type'], React.ReactNode> = {
  'most-championships': <Trophy className="h-5 w-5 text-yellow-500" />,
  'best-regular-season': <TrendingUp className="h-5 w-5 text-green-500" />,
  'most-points': <Target className="h-5 w-5 text-blue-500" />,
  'most-wins': <Star className="h-5 w-5 text-purple-500" />,
  'most-playoff-appearances': <Award className="h-5 w-5 text-orange-500" />,
};

export function AllTimeRecords({ records }: AllTimeRecordsProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card data-testid="all-time-records">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          All-Time Records
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((record) => (
            <div key={record.type} data-testid={record.type} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                {iconMap[record.type]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">{record.title}</p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={record.holder.avatarUrl} alt={record.holder.name} />
                    <AvatarFallback className="text-[8px]">{getInitials(record.holder.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">{record.holder.name}</span>
                </div>
                <p className="text-lg font-bold">{record.value}</p>
                {record.seasons && record.seasons.length > 0 && (
                  <p className="text-muted-foreground text-xs">({record.seasons.join(', ')})</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
