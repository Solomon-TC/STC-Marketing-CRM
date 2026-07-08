'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/lib/types';
import { contactDisplayName } from '@/lib/types';

export default function TasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showDone, setShowDone] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('tasks')
      .select('*, contacts(id, name, company)')
      .order('due_date', { ascending: true });
    setTasks((data as any) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(task: Task) {
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id);
    load();
  }

  const visible = tasks.filter((t) => showDone || !t.done);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Tasks</h1>
          <p className="text-sm text-ink/60">Across all contacts</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink/60">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show completed
        </label>
      </div>

      <div className="card divide-y divide-black/5 p-0">
        {visible.length === 0 && <p className="p-4 text-sm text-ink/50">Nothing here.</p>}
        {visible.map((task: any) => (
          <label key={task.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="flex items-center gap-3">
              <input type="checkbox" checked={task.done} onChange={() => toggle(task)} />
              <span className={task.done ? 'text-ink/40 line-through' : ''}>{task.title}</span>
            </span>
            <span className="text-ink/50">
              {task.contacts ? contactDisplayName(task.contacts) : 'No contact'}{' '}
              {task.due_date ? `· ${task.due_date}` : ''}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-ink/40">
        Add tasks from a contact&apos;s page so they stay linked to the right person.
      </p>
    </div>
  );
}
