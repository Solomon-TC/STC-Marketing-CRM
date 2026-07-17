'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WON_OR_BETTER_STAGES } from '@/lib/types';
import RevenueChart, { type RevenuePoint } from '@/components/RevenueChart';

const STATIC_COLOR = '#16A34A'; // green -- one-time revenue
const RECURRING_COLOR = '#2563EB'; // blue -- monthly recurring revenue

// Static Revenue = Spotlights Pipeline's Value + Websites Pipeline's Initial
// Value, for deals at Won or further. Recurring Revenue = Websites
// Pipeline's Recurring Value only, same stage filter. Both update live via
// Supabase Realtime on the deals and website_deals tables.
export default function FinancesPage() {
  const supabase = createClient();
  const [staticPoints, setStaticPoints] = useState<RevenuePoint[]>([]);
  const [recurringPoints, setRecurringPoints] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: deals }, { data: websiteDeals }] = await Promise.all([
      supabase.from('deals').select('value, won_at').in('stage', WON_OR_BETTER_STAGES),
      supabase.from('website_deals').select('initial_value, recurring_value, won_at').in('stage', WON_OR_BETTER_STAGES),
    ]);

    const staticFromDeals = (deals ?? [])
      .filter((d) => d.value != null && d.won_at)
      .map((d) => ({ date: d.won_at as string, amount: Number(d.value) }));
    const staticFromWebsites = (websiteDeals ?? [])
      .filter((d) => d.initial_value != null && d.won_at)
      .map((d) => ({ date: d.won_at as string, amount: Number(d.initial_value) }));
    setStaticPoints([...staticFromDeals, ...staticFromWebsites]);

    const recurring = (websiteDeals ?? [])
      .filter((d) => d.recurring_value != null && d.won_at)
      .map((d) => ({ date: d.won_at as string, amount: Number(d.recurring_value) }));
    setRecurringPoints(recurring);

    setLoading(false);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel('finances-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_deals' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staticTotal = staticPoints.reduce((sum, p) => sum + p.amount, 0);
  const recurringTotal = recurringPoints.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Finances</h1>
        <p className="text-sm text-ink/60">
          Revenue from Won-or-better deals across both pipelines, updating live.
        </p>
      </div>

      <div className="card">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Static Revenue</h2>
          <span className="text-xs text-ink/40">Spotlights Value + Websites Initial Value</span>
        </div>
        <p className="mb-4 text-3xl font-medium text-ink">
          {loading ? '...' : `$${staticTotal.toLocaleString()}`}
        </p>
        <RevenueChart points={staticPoints} color={STATIC_COLOR} />
      </div>

      <div className="card">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Recurring Revenue</h2>
          <span className="text-xs text-ink/40">Websites Recurring Value, per month</span>
        </div>
        <p className="mb-4 text-3xl font-medium text-ink">
          {loading ? '...' : `$${recurringTotal.toLocaleString()}/mo`}
        </p>
        <RevenueChart points={recurringPoints} color={RECURRING_COLOR} />
      </div>
    </div>
  );
}
