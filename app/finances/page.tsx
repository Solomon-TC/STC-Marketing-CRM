'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import RevenueChart from '@/components/RevenueChart';
import { REVENUE_CLIENT_COLUMNS, revenueFromClients, type RevenueClient } from '@/lib/revenue';

// Whole dollars stay whole; anything with cents shows both digits ($2,734.50).
function money(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

const STATIC_COLOR = '#16A34A'; // green -- one-time revenue
const RECURRING_COLOR = '#2563EB'; // blue -- monthly recurring revenue

// Revenue from Website Builds' build and monthly fees (rules in
// lib/revenue.ts), updating live via Supabase Realtime on website_clients.
export default function FinancesPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<RevenueClient[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('website_clients').select(REVENUE_CLIENT_COLUMNS);
    setClients((data as RevenueClient[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel('finances-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_clients' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { staticPoints, recurringPoints, staticTotal, recurringTotal } = revenueFromClients(clients);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Finances</h1>
        <p className="text-sm text-fog">Revenue from Website Builds&apos; build and monthly fees, updating live.</p>
      </div>

      <div className="card">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Static Revenue</h2>
          <span className="text-right text-xs text-mist">Build fees, dated by Date closed</span>
        </div>
        <p className="mb-4 text-3xl font-medium text-paper">
          {loading ? '...' : money(staticTotal)}
        </p>
        <RevenueChart points={staticPoints} color={STATIC_COLOR} />
      </div>

      <div className="card">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Recurring Revenue</h2>
          <span className="text-right text-xs text-mist">Monthly fees of clients with Active maintenance</span>
        </div>
        <p className="mb-4 text-3xl font-medium text-paper">
          {loading ? '...' : `${money(recurringTotal)}/mo`}
        </p>
        <RevenueChart points={recurringPoints} color={RECURRING_COLOR} />
      </div>
    </div>
  );
}
