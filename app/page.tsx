import Link from 'next/link';
import SocialPostCard from '@/components/SocialPostCard';
import DashboardCalendar from '@/components/DashboardCalendar';
import { createClient } from '@/lib/supabase/server';
import {
  contactDisplayName,
  daysSince,
  WEBSITE_CLIENT_STAGES,
  type WebsiteClientStage,
} from '@/lib/types';
import { REVENUE_CLIENT_COLUMNS, revenueFromClients, type RevenueClient } from '@/lib/revenue';

export const dynamic = 'force-dynamic';

const INTAKE_STAGES: WebsiteClientStage[] = ['new', 'intake', 'info_received'];
const BUILD_STAGES: WebsiteClientStage[] = ['building', 'client_review', 'revisions', 'domain_setup'];
const LIVE_STAGES: WebsiteClientStage[] = ['live', 'maintenance'];

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

type DashboardClient = RevenueClient & {
  id: string;
  business_name: string;
  stage: WebsiteClientStage;
  stage_changed_at: string;
};

// Read-only overview: every number here is a plain select. The only thing
// on the page that writes are the social media check (SocialPostCard, its own
// social_posts table) and ticking items off in the calendar
// (DashboardCalendar, the same tick-off the To-Do page does).
export default async function DashboardPage() {
  const supabase = createClient();

  const [
    { count: contactCount },
    { data: clientRows },
    { data: settings },
    { data: openTasks },
    { data: openTodos },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('website_clients').select(`id, business_name, stage, stage_changed_at, ${REVENUE_CLIENT_COLUMNS}`),
    supabase.from('website_pipeline_settings').select('stuck_threshold_days').eq('id', 1).maybeSingle(),
    supabase
      .from('tasks')
      .select('id, title, due_date, contacts(id, company)')
      .eq('done', false)
      .order('due_date', { ascending: true })
      .limit(6),
    supabase
      .from('website_todos')
      .select('id, title')
      .eq('done', false)
      .order('created_at', { ascending: true })
      .limit(6),
  ]);

  const clients = (clientRows as DashboardClient[] | null) ?? [];

  // Same combined list the To-Do tab shows: contact tasks (soonest due
  // first) then personal to-dos.
  const upcoming = [
    ...(openTasks ?? []).map((t: any) => ({
      key: `task-${t.id}`,
      title: t.title as string,
      detail: `${t.contacts ? `${contactDisplayName(t.contacts)} · ` : ''}${t.due_date ?? 'no due date'}`,
    })),
    ...(openTodos ?? []).map((t) => ({ key: `todo-${t.id}`, title: t.title as string, detail: 'To-do' })),
  ].slice(0, 6);

  // --- Websites pipeline (same "stuck" rule as its board) ---
  const threshold = settings?.stuck_threshold_days ?? 5;
  const inGroup = (group: WebsiteClientStage[]) => clients.filter((c) => group.includes(c.stage)).length;
  const intakeCount = inGroup(INTAKE_STAGES);
  const buildCount = inGroup(BUILD_STAGES);
  const liveCount = inGroup(LIVE_STAGES);
  const pct = (n: number) => (clients.length ? Math.round((n / clients.length) * 100) : 0);
  const stuck = clients
    .filter((c) => c.stage !== 'maintenance' && daysSince(c.stage_changed_at) >= threshold)
    .sort((a, b) => daysSince(b.stage_changed_at) - daysSince(a.stage_changed_at));
  const stageLabel = (s: WebsiteClientStage) => WEBSITE_CLIENT_STAGES.find((x) => x.value === s)?.label ?? s;

  // --- Revenue: lib/revenue.ts, shared with Finances so the totals match ---
  const { staticTotal, recurringTotal } = revenueFromClients(clients);
  const activeMaintenance = clients.filter((c) => c.maintenance_status === 'active').length;

  return (
    <div className="dashboard space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Dashboard</h1>
          <p className="text-sm text-fog">A snapshot of website builds, revenue, and what&apos;s next.</p>
        </div>
        <Link href="/contacts" className="chip-glass gap-2 px-3 py-1.5 text-sm hover:bg-white/15">
          <IconUsers /> {(contactCount ?? 0).toLocaleString()} contacts
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left two-thirds */}
        <div className="grid gap-6 md:grid-cols-2 lg:col-span-8">
          {/* Website builds */}
          <section className="card">
            <PanelTitle title="Website builds" href="/websites" />
            <div className="mt-4 flex items-end gap-3">
              <p className="text-4xl font-medium tracking-tight">{clients.length}</p>
              <p className="pb-1 text-xs leading-tight text-fog">
                clients in
                <br />
                the build pipeline
              </p>
            </div>

            <div className="mt-5 flex gap-1.5">
              <Segment pct={pct(intakeCount)} className="bg-amber-300" />
              <Segment pct={pct(buildCount)} className="bg-cyan-300" />
              <Segment pct={pct(liveCount)} className="bg-lime-300" />
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-mist">
              <span>Intake {pct(intakeCount)}%</span>
              <span>Building {pct(buildCount)}%</span>
              <span>Live {pct(liveCount)}%</span>
            </div>

            <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/[0.07] bg-white/[0.04] py-3">
              <MiniStat icon={<IconBolt />} iconClass="bg-cyan-300" value={intakeCount + buildCount} label="In progress" />
              <MiniStat icon={<IconCheck />} iconClass="bg-lime-300" value={liveCount} label="Live" />
              <MiniStat icon={<IconX />} iconClass="bg-amber-300" value={stuck.length} label="Stuck" />
            </div>
          </section>

          {/* Revenue */}
          <section className="card flex flex-col">
            <div className="flex flex-wrap gap-2">
              <span className="chip-lime">Build fees</span>
              <span className="chip-cyan">Monthly fees</span>
            </div>
            <h2 className="mt-4 font-serif text-xl">Revenue</h2>
            <p className="mt-1 text-xs text-mist">
              From the Websites pipeline. Monthly fees count while maintenance is Active ({activeMaintenance}{' '}
              {activeMaintenance === 1 ? 'client' : 'clients'}).
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-xs text-fog">Static</p>
                <p className="mt-1 text-2xl font-medium tracking-tight">{money(staticTotal)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-xs text-fog">Recurring</p>
                <p className="mt-1 text-2xl font-medium tracking-tight">
                  {money(recurringTotal)}
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

          {/* Stuck builds */}
          <section className="card md:col-span-2">
            <PanelTitle title="Needs attention" href="/websites" />
            {stuck.length === 0 && (
              <p className="mt-4 text-sm text-mist">No build has sat in one stage for {threshold}+ days.</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stuck.slice(0, 6).map((client) => {
                const days = daysSince(client.stage_changed_at);
                return (
                  <Link key={client.id} href={`/websites/${client.id}`} className="tile block p-4">
                    <p className="text-xs text-mist">
                      {days} {days === 1 ? 'day' : 'days'} in stage
                    </p>
                    <p className="mt-1 font-serif text-lg">{client.business_name}</p>
                    <span className="chip-amber mt-3">{stageLabel(client.stage)}</span>
                  </Link>
                );
              })}
            </div>
            {stuck.length > 6 && <p className="mt-3 text-xs text-mist">+{stuck.length - 6} more on the board</p>}
          </section>

          {/* To-Do */}
          <section className="card md:col-span-2">
            <PanelTitle title="To-Do" href="/todo" />
            {upcoming.length === 0 && <p className="mt-4 text-sm text-mist">Nothing to do.</p>}
            <div className="mt-3 divide-y divide-white/[0.06]">
              {upcoming.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{item.title}</span>
                  <span className="shrink-0 text-mist">{item.detail}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right third */}
        <div className="grid content-start gap-6 lg:col-span-4">
          {/* Daily social media check */}
          <SocialPostCard />

          {/* Website builds by stage */}
          <section className="card">
            <h2 className="text-sm font-medium">Builds by stage</h2>
            <div className="mt-3 divide-y divide-white/[0.06]">
              {WEBSITE_CLIENT_STAGES.map((stage) => {
                const count = clients.filter((c) => c.stage === stage.value).length;
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
                      <p className="text-sm font-medium">{stage.label}</p>
                    </div>
                    <p className="text-sm text-fog">{count}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* To-Do calendar (same as the To-Do page's) */}
      <DashboardCalendar />
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
  return <div className={`animate-grow-x h-1.5 rounded-full ${className}`} style={{ width: `${pct}%` }} />;
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
