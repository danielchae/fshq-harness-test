import { ScrollText } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { TransactionList } from '@/components/transactions/transaction-list';

interface TransactionsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TransactionsPage({ params }: TransactionsPageProps) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader icon={ScrollText} title="Transactions" description="Recent trades, waivers, and roster moves" />
      <TransactionList leagueSlug={slug} />
    </div>
  );
}
