'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WebsiteTodo } from '@/lib/types';

// A plain personal to-do list for the Websites view. Its own table
// (website_todos) -- not the sales-side `tasks`, which are tied to contacts.
export default function WebsiteTodoPage() {
  const supabase = createClient();
  const [todos, setTodos] = useState<WebsiteTodo[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from('website_todos')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setTodos(data ?? []);
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

  async function toggle(todo: WebsiteTodo) {
    const done = !todo.done;
    // Tick it locally first so the checkbox responds instantly instead of
    // waiting on the save round-trip.
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done } : t)));
    await supabase
      .from('website_todos')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', todo.id);
    load();
  }

  async function remove(todo: WebsiteTodo) {
    await supabase.from('website_todos').delete().eq('id', todo.id);
    load();
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">To-Do</h1>
        <p className="text-sm text-fog">
          {open.length} open {open.length === 1 ? 'task' : 'tasks'}
        </p>
      </div>

      <form onSubmit={add} className="card flex gap-2">
        <input
          className="input"
          placeholder="Add a task..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0">
          Add
        </button>
      </form>

      {error && <p className="text-sm text-warn">{error}</p>}

      <div className="card divide-y divide-white/5 p-0">
        {open.length === 0 && <p className="p-4 text-sm text-mist">Nothing to do.</p>}
        {open.map((todo) => (
          <TodoRow key={todo.id} todo={todo} onToggle={() => toggle(todo)} onRemove={() => remove(todo)} />
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-mist">Completed</h2>
          <div className="card divide-y divide-white/5 p-0">
            {done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={() => toggle(todo)} onRemove={() => remove(todo)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onRemove,
}: {
  todo: WebsiteTodo;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <label className="flex min-w-0 items-center gap-3">
        <input type="checkbox" checked={todo.done} onChange={onToggle} />
        <span className={todo.done ? 'text-mist line-through' : ''}>{todo.title}</span>
      </label>
      <button onClick={onRemove} className="shrink-0 text-xs text-mist hover:text-warn hover:underline">
        Delete
      </button>
    </div>
  );
}
