import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  BREAK_EVEN_COST,
  contactDisplayName,
  DEAL_STAGES,
  formatCardMonth,
  WEBSITE_DEAL_STAGES,
  WON_OR_BETTER_STAGES,
  type DealStage,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

// Short axis labels for the Websites pipeline bar chart.
const SHORT_STAGE: Record<DealStage, string> = {
  cold_lead: 'Cold',
  warm_lead: 'Warm',
  called_contacted: 'Called',
  requested_followup: 'Req. FU',
  followed_up: "FU'd",
  won: 'Won',
  fulfilled_obligation: 'Fulfilled',
  lost: 'Lost',
};

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

// Read-only overview of the Sales side: every number here is a plain select,
// nothing on this page writes to the database.
export default async function DashboardPage() {
  const supabase = createClient();

  const [{ count: contactCount }, { data: deals }, { data: websiteDeals }, { data: openTasks }, { data: activeCards }] =
    await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('deals').select('stage, value, won_at'),
      supabase.from('website_deals').select('stage, initial_value, recurring_value, won_at'),
      supabase
        .from('tasks')
        .select('id, title, due_date, contacts(id, company)')
        .eq('done', false)
        .order('due_date', { ascending: true })
        .limit(6),
      supabase
        .from('cards')
        .select('id, city, month, status, card_slots(price, status)')
        .in('status', ['filling', 'ready'])
        .order('month', { ascending: true }),
    ]);

  // --- Spotlights pipeline (same figures the old Dashboard showed) ---
  const stageCounts: Record<string, number> = {};
  const stageValue: Record<string, number> = {};
  (deals ?? []).forEach((d) => {
    stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1;
    stageValue[d.stage] = (stageValue[d.stage] ?? 0) + (Number(d.value) || 0);
  });
  const isOpen = (s: string) => !['won', 'fulfilled_obligation', 'lost'].includes(s);
  const openDeals = (deals ?? []).filter((d) => isOpen(d.stage));
  const totalOpenValue = openDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const leadCount = stageCounts['warm_lead'] ?? 0;
  const followUpCount =
    (stageCounts['called_contacted'] ?? 0) + (stageCounts['requested_followup'] ?? 0) + (stageCounts['followed_up'] ?? 0);
  const closedCount = (stageCounts['won'] ?? 0) + (stageCounts['fulfilled_obligation'] ?? 0);
  const segmentTotal = leadCount + followUpCount + closedCount;
  const pct = (n: number) => (segmentTotal ? Math.round((n / segmentTotal) * 100) : 0);

  // --- Revenue: same rules as the Finances page, so the totals match it ---
  const wonOrBetter = (s: string) => WON_OR_BETTER_STAGES.includes(s as DealStage);
  const staticRevenue =
    (deals ?? [])
      .filter((d) => wonOrBetter(d.stage) && d.value != null && d.won_at)
      .reduce((sum, d) => sum + Number(d.value), 0) +
    (websiteDeals ?? [])
      .filter((d) => wonOrBetter(d.stage) && d.initial_value != null && d.won_at)
      .reduce((sum, d) => sum + Number(d.initial_value), 0);
  const recurringRevenue = (websiteDeals ?? [])
    .filter((d) => wonOrBetter(d.stage) && d.recurring_value != null && d.won_at)
    .reduce((sum, d) => sum + Number(d.recurring_value), 0);

  // --- Websites pipeline counts for the bar chart ---
  const websiteCounts = WEBSITE_DEAL_STAGES.map((s) => ({
    ...s,
    count: (websiteDeals ?? []).filter((d) => d.stage === s.value).length,
  }));
  const maxWebsiteCount = Math.max(1, ...websiteCounts.map((s) => s.count));
  const busiestStage = websiteCounts.reduce((a, b) => (b.count > a.count ? b : a), websiteCounts[0]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Dashboard</h1>
          <p className="text-sm text-fog">A snapshot of contacts, pipelines, revenue, and what&apos;s next.</p>
        </div>
        <Link href="/contacts" className="chip-glass gap-2 px-3 py-1.5 text-sm hover:bg-white/15">
          <IconUsers /> {(contactCount ?? 0).toLocaleString()} contacts
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left two-thirds */}
        <div className="grid gap-6 md:grid-cols-2 lg:col-span-8">
          {/* Spotlights pipeline */}
          <section className="card">
            <PanelTitle title="Spotlights pipeline" href="/deals" />
            <div className="mt-4 flex items-end gap-3">
              <p className="text-4xl font-medium tracking-tight">{money(totalOpenValue)}</p>
              <p className="pb-1 text-xs leading-tight text-fog">
                Open pipeline
                <br />
                value
              </p>
            </div>

            <div className="mt-5 flex gap-1.5">
              <Segment pct={pct(leadCount)} className="bg-amber-300" />
              <Segment pct={pct(followUpCount)} className="bg-cyan-300" />
              <Segment pct={pct(closedCount)} className="bg-lime-300" />
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-mist">
              <span>Leads {pct(leadCount)}%</span>
              <span>Follow-up {pct(followUpCount)}%</span>
              <span>Closed {pct(closedCount)}%</span>
            </div>

            <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/[0.07] bg-white/[0.04] py-3">
              <MiniStat icon={<IconBolt />} iconClass="bg-cyan-300" value={openDeals.length} label="Open" />
              <MiniStat icon={<IconCheck />} iconClass="bg-lime-300" value={stageCounts['won'] ?? 0} label="Won" />
              <MiniStat icon={<IconX />} iconClass="bg-amber-300" value={stageCounts['lost'] ?? 0} label="Lost" />
            </div>
          </section>

          {/* Revenue */}
          <section className="card flex flex-col">
            <div className="flex flex-wrap gap-2">
              <span className="chip-lime">Static</span>
              <span className="chip-cyan">Recurring</span>
            </div>
            <h2 className="mt-4 font-serif text-xl">Revenue</h2>
            <p className="mt-1 text-xs text-mist">From Won and Fulfilled deals across both pipelines.</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-xs text-fog">Static</p>
                <p className="mt-1 text-2xl font-medium tracking-tight">{money(staticRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-xs text-fog">Recurring</p>
                <p className="mt-1 text-2xl font-medium tracking-tight">
                  {money(recurringRevenue)}
                  <span className="text-sm text-mist">/mo</span>
                </p>
              </div>
            </div>

            <div className="min-h-5 flex-1" />
            <Link
              href="/finances"
              className="block rounded-full border border-white/10 bg-white/[0.05] py-2 text-center text-sm text-paper transition hover:bg-white/10"
            >
              Open finances
            </Link>
          </section>

          {/* Active cards */}
          <section className="card md:col-span-2">
            <PanelTitle title="Active cards" href="/cards" />
            {(!activeCards || activeCards.length === 0) && (
              <p className="mt-4 text-sm text-mist">No cards are filling or ready right now.</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(activeCards ?? []).map((card: any) => {
                const slots: { price: number; status: string }[] = card.card_slots ?? [];
                const filled = slots.filter((s) => s.status === 'filled');
                const revenue = filled.reduce((sum, s) => sum + s.price, 0);
                const fillPct = slots.length ? Math.round((filled.length / slots.length) * 100) : 0;
                return (
                  <Link key={card.id} href={`/cards/${card.id}`} className="tile block p-4">
                    <p className="text-xs text-mist">{formatCardMonth(card.month)}</p>
                    <p className="mt-1 font-serif text-lg">{card.city}</p>
                    <span className={`mt-3 ${card.status === 'ready' ? 'chip-lime' : 'chip-amber'}`}>
                      {card.status === 'ready' ? 'Ready to Send' : 'Filling'}
                    </span>
                    <div className="mt-4 h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-pineLight" style={{ width: `${fillPct}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-fog">
                      <span>
                        {filled.length}/{slots.length} slots
                      </span>
                      <span>
                        {money(revenue)} / {money(BREAK_EVEN_COST)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Upcoming tasks */}
          <section className="card md:col-span-2">
            <PanelTitle title="Upcoming tasks" href="/tasks" />
            {(!openTasks || openTasks.length === 0) && (
              <p className="mt-4 text-sm text-mist">Nothing due. Add tasks from a contact or deal.</p>
            )}
            <div className="mt-3 divide-y divide-white/[0.06]">
              {(openTasks ?? []).map((task: any) => (
                <div key={task.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{task.title}</span>
                  <span className="shrink-0 text-mist">
                    {task.contacts ? `${contactDisplayName(task.contacts)} · ` : ''}
                    {task.due_date ?? 'no due date'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right third */}
        <div className="grid content-start gap-6 lg:col-span-4">
          {/* Websites pipeline bar chart */}
          <section className="card">
            <PanelTitle title="Websites pipeline" href="/website-deals" />
            <div className="mt-4 flex items-end gap-2">
              <p className="text-4xl font-medium tracking-tight">{(websiteDeals ?? []).length}</p>
              <p className="pb-1 text-xs text-fog">deals</p>
            </div>

            <div className="mt-6 flex h-48 items-end gap-1.5">
              {websiteCounts.map((s) => {
                const isMax = s.value === busiestStage.value && s.count > 0;
                const height = Math.max(8, Math.round((s.count / maxWebsiteCount) * 100));
                return (
                  <div
                    key={s.value}
                    className="relative flex h-full flex-1 flex-col items-center justify-end"
                    title={`${s.label}: ${s.count}`}
                  >
                    {isMax && <span className="chip-cyan absolute -top-1 whitespace-nowrap">{s.count}</span>}
                    <div
                      className={`w-full rounded-full ${
                        isMax ? 'bg-paper/90' : 'border border-white/10 bg-white/[0.08]'
                      }`}
                      style={{ height: `${height}%`, maxHeight: 'calc(100% - 1.5rem)' }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1.5">
              {websiteCounts.map((s) => (
                <div key={s.value} className="flex-1 text-center">
                  <p className="truncate text-[10px] text-mist">{SHORT_STAGE[s.value]}</p>
                  <p className="text-[11px] text-fog">{s.count}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Spotlights deals by stage */}
          <section className="card">
            <h2 className="text-sm font-medium">Spotlights by stage</h2>
            <div className="mt-3 divide-y divide-white/[0.06]">
              {DEAL_STAGES.map((stage) => {
                const count = stageCounts[stage.value] ?? 0;
                const value = stageValue[stage.value] ?? 0;
                return (
                  <div key={stage.value} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-4 w-4 items-center justify-center ${
                          count > 0 ? 'text-lime-300' : 'text-white/20'
                        }`}
                      >
                        <IconCheck />
                      </span>
                      <div>
                        <p className="text-[11px] text-mist">
                          {count} {count === 1 ? 'deal' : 'deals'}
                        </p>
                        <p className="text-sm font-medium">{stage.label}</p>
                      </div>
                    </div>
                    <p className="text-sm text-fog">{value > 0 ? money(value) : '—'}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PanelTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-medium">{title}</h2>
      <Link
        href={href}
        aria-label={`Open ${title}`}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-fog transition hover:bg-white/10 hover:text-paper"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

function Segment({ pct, className }: { pct: number; className: string }) {
  if (pct === 0) return null;
  return <div className={`h-1.5 rounded-full ${className}`} style={{ width: `${pct}%` }} />;
}

function MiniStat({
  icon,
  iconClass,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconClass: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-ink ${iconClass}`}>{icon}</span>
      <p className="text-xl font-medium">{value}</p>
      <p className="text-[11px] text-fog">{label}</p>
    </div>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zm13 9v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8"
      />
    </svg>
  );
}
