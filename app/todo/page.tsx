'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { contactDisplayName } from '@/lib/types';

// One list over two existing tables, with nothing moved between them:
//  - website_todos: personal to-dos, added here (and deletable here)
//  - tasks: tasks tied to a contact, still added from that contact's page
// Each item remembers which table it came from, so ticking it updates only
// that row in that table.
type Item = {
  key: string;
  source: 'todo' | 'task';
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  created_at: string;
  contact: { id: string; company: string | null } | null;
};

// Dated items first (soonest first), then undated ones oldest-first.
function byDueThenCreated(a: Item, b: Item) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

export default function TodoPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [todos, tasks] = await Promise.all([
      supabase.from('website_todos').select('*'),
      supabase.from('tasks').select('id, title, done, due_date, created_at, contacts(id, company)'),
    ]);
    const err = todos.error ?? tasks.error;
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setItems([
      ...(todos.data ?? []).map(
        (t): Item => ({
          key: `todo-${t.id}`,
          source: 'todo',
          id: t.id,
          title: t.title,
          done: t.done,
          due_date: null,
          created_at: t.created_at,
          contact: null,
        })
      ),
      ...(tasks.data ?? []).map(
        (t: any): Item => ({
          key: `task-${t.id}`,
          source: 'task',
          id: t.id,
          title: t.title,
          done: t.done,
          due_date: t.due_date,
          created_at: t.created_at,
          contact: t.contacts ?? null,
        })
      ),
    ]);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from('website_todos').insert({ title: title.trim() });
    if (error) {
      setError(error.message);
      return;
    }
    setTitle('');
    load();
  }

  async function toggle(item: Item) {
    const done = !item.done;
    // Tick it locally first so the checkbox responds instantly.
    setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, done } : i)));
    if (item.source === 'todo') {
      await supabase
        .from('website_todos')
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq('id', item.id);
    } else {
      // Same update the old Tasks page made -- tasks has no done_at column.
      await supabase.from('tasks').update({ done }).eq('id', item.id);
    }
    load();
  }

  // Only personal to-dos can be deleted here. Contact tasks never had a
  // delete anywhere in the app, and this doesn't add one.
  async function remove(item: Item) {
    if (item.source !== 'todo') return;
    await supabase.from('website_todos').delete().eq('id', item.id);
    load();
  }

  const open = items.filter((i) => !i.done).sort(byDueThenCreated);
  const done = items.filter((i) => i.done).sort(byDueThenCreated);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">To-Do</h1>
        <p className="text-sm text-fog">
          {open.length} open · your to-dos plus tasks linked to contacts
        </p>
      </div>

      <form onSubmit={add} className="card flex gap-2">
        <input
          className="input"
          placeholder="Add a to-do..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0">
          Add
        </button>
      </form>

      {error && <p className="text-sm text-warn">{error}</p>}

      <div className="card divide-y divide-white/[0.06] p-0">
        {loaded && open.length === 0 && <p className="p-5 text-sm text-mist">Nothing to do.</p>}
        {open.map((item) => (
          <Row key={item.key} item={item} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-mist">Completed</h2>
          <div className="card divide-y divide-white/[0.06] p-0">
            {done.map((item) => (
              <Row key={item.key} item={item} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-mist">
        To add a task linked to a contact, open the contact (Tools → Contacts) and add it there.
      </p>
    </div>
  );
}

function Row({ item, onToggle, onRemove }: { item: Item; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <label className="flex min-w-0 items-center gap-3">
        <input type="checkbox" checked={item.done} onChange={onToggle} />
        <span className={item.done ? 'text-mist line-through' : ''}>{item.title}</span>
      </label>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {item.contact && (
          <Link href={`/contacts/${item.contact.id}`} className="chip-glass hover:bg-white/15">
            {contactDisplayName(item.contact)}
          </Link>
        )}
        {item.due_date && <span className="text-mist">{item.due_date}</span>}
        {item.source === 'todo' && (
          <button onClick={onRemove} className="text-mist hover:text-warn hover:underline">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
