import { createClient } from '@/lib/supabase/server';
import { contactDisplayName, DEAL_STAGES, type DealStage } from '@/lib/types';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ count: contactCount }, { data: deals }, { data: openTasks }] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('deals').select('stage, value'),
    supabase
      .from('tasks')
      .select('id, title, due_date, contacts(id, company)')
      .eq('done', false)
      .order('due_date', { ascending: true })
      .limit(6),
  ]);

  const stageCounts: Record<string, number> = {};
  const stageValue: Record<string, number> = {};
  (deals ?? []).forEach((d) => {
    stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1;
    stageValue[d.stage] = (stageValue[d.stage] ?? 0) + (Number(d.value) || 0);
  });

  const totalOpenValue = (deals ?? [])
    .filter((d) => !['won', 'fulfilled_obligation', 'lost'].includes(d.stage as DealStage))
    .reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const wonCount = stageCounts['won'] ?? 0;
  const lostCount = stageCounts['lost'] ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl">Dashboard</h1>
        <p className="text-sm text-ink/60">A snapshot of contacts, pipeline, and open tasks.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-ink/50">Total contacts</p>
          <p className="mt-1 text-2xl font-medium">{contactCount ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink/50">Open pipeline value</p>
          <p className="mt-1 text-2xl font-medium">
            ${totalOpenValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-ink/50">Won deals</p>
          <p className="mt-1 text-2xl font-medium">{wonCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-ink/50">Lost deals</p>
          <p className="mt-1 text-2xl font-medium">{lostCount}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-medium">Deals by stage</h2>
          <div className="space-y-2">
            {DEAL_STAGES.map((stage) => {
              const count = stageCounts[stage.value] ?? 0;
              const value = stageValue[stage.value] ?? 0;
              return (
                <div key={stage.value} className="flex items-center justify-between text-sm">
                  <span className="text-ink/70">{stage.label}</span>
                  <span className="text-ink/50">
                    {count} {count === 1 ? 'deal' : 'deals'}
                    {value > 0 && ` · $${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-medium">Upcoming tasks</h2>
          {(!openTasks || openTasks.length === 0) && (
            <p className="text-sm text-ink/50">Nothing due. Add tasks from a contact or deal.</p>
          )}
          <div className="space-y-2">
            {(openTasks ?? []).map((task: any) => (
              <div key={task.id} className="flex items-center justify-between text-sm">
                <span>{task.title}</span>
                <span className="text-ink/50">
                  {task.contacts ? `${contactDisplayName(task.contacts)} · ` : ''}
                  {task.due_date ?? 'no due date'}
                </span>
              </div>
            ))}
          </div>
          <Link href="/tasks" className="mt-3 inline-block text-sm text-accent hover:underline">
            View all tasks
          </Link>
        </div>
      </div>
    </div>
  );
}
