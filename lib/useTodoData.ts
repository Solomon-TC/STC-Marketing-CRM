'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dayKey } from '@/lib/dates';
import { findReminder, occurrencesThroughNext, REMINDERS, remindersOn, type Reminder } from '@/lib/reminders';

// Everything the To-Do list and calendar show, shared by the To-Do page and
// the Dashboard calendar. One list over two existing tables, with nothing
// moved between them:
//  - website_todos: personal to-dos (added and deletable on the To-Do page)
//  - tasks: tasks tied to a contact, still added from that contact's page
// plus the recurring reminders from lib/reminders.ts, whose tick-offs live in
// reminder_checks. Each item remembers where it came from, so ticking it
// updates only that row in that table.
//
// Completed items stay listed for 5 days after they were checked off, then
// drop off the list. Nothing is deleted -- the rows stay in the database,
// and unticking within the 5 days brings an item straight back.

export type Client = { id: string; business_name: string; stage: string };

export type Item = {
  key: string;
  source: 'todo' | 'task' | 'reminder';
  id: string;
  title: string;
  note?: string;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  created_at: string;
  contact: { id: string; company: string | null } | null;
  reminder?: Reminder;
  clients?: Client[];
};

export const HIDE_COMPLETED_AFTER_DAYS = 5;

// Done long enough ago to drop off the list. Items with no recorded
// completion time stay visible rather than vanish unexpectedly.
function completedLongAgo(item: Item) {
  if (!item.done || !item.done_at) return false;
  return Date.now() - new Date(item.done_at).getTime() > HIDE_COMPLETED_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

// Dated items first (soonest first), then undated ones oldest-first.
function byDueThenCreated(a: Item, b: Item) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

const checkKey = (reminder: string, day: string) => `${reminder}|${day}`;

// onChange runs after any write (the Dashboard uses it to refresh its
// server-rendered panels).
export function useTodoData(onChange?: () => void) {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [checks, setChecks] = useState<Record<string, string>>({}); // checkKey -> done_at
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(() => dayKey(new Date()));

  async function load() {
    const [todos, tasks, reminderChecks, clientRows] = await Promise.all([
      supabase.from('website_todos').select('*'),
      supabase.from('tasks').select('id, title, done, done_at, due_date, created_at, contacts(id, company)'),
      supabase.from('reminder_checks').select('reminder, due_on, done_at'),
      supabase.from('website_clients').select('id, business_name, stage').in('stage', ['live', 'maintenance']),
    ]);
    const err = todos.error ?? tasks.error ?? reminderChecks.error ?? clientRows.error;
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
          done_at: t.done_at,
          due_date: t.due_date ?? null,
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
          done_at: t.done_at,
          due_date: t.due_date,
          created_at: t.created_at,
          contact: t.contacts ?? null,
        })
      ),
    ]);
    setChecks(Object.fromEntries((reminderChecks.data ?? []).map((c) => [checkKey(c.reminder, c.due_on), c.done_at])));
    setClients(((clientRows.data as Client[] | null) ?? []).sort((a, b) => a.business_name.localeCompare(b.business_name)));
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // Keep "today" right if the page is left open past midnight.
    const tick = setInterval(() => setToday(dayKey(new Date())), 60_000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reminderItem(reminder: Reminder, day: string): Item {
    const doneAt = checks[checkKey(reminder.key, day)] ?? null;
    return {
      key: `reminder-${reminder.key}-${day}`,
      source: 'reminder',
      id: day,
      title: reminder.title,
      note: reminder.note,
      done: doneAt !== null,
      done_at: doneAt,
      due_date: day,
      created_at: day,
      contact: null,
      reminder,
      clients: clients.filter((c) => reminder.clientStages.includes(c.stage)),
    };
  }

  // Returns true when saved, so the form knows to clear itself.
  async function add(title: string, dueDate: string) {
    const { error } = await supabase.from('website_todos').insert({ title: title.trim(), due_date: dueDate || null });
    if (error) {
      setError(error.message);
      return false;
    }
    await load();
    onChange?.();
    return true;
  }

  async function toggle(item: Item) {
    const done = !item.done;
    const done_at = done ? new Date().toISOString() : null;
    // Tick it locally first so the checkbox responds instantly.
    if (item.source === 'reminder' && item.reminder) {
      const k = checkKey(item.reminder.key, item.id);
      setChecks((prev) => {
        const next = { ...prev };
        if (done_at) next[k] = done_at;
        else delete next[k];
        return next;
      });
      const { error } = done
        ? await supabase
            .from('reminder_checks')
            .upsert({ reminder: item.reminder.key, due_on: item.id }, { onConflict: 'reminder,due_on', ignoreDuplicates: true })
        : await supabase.from('reminder_checks').delete().eq('reminder', item.reminder.key).eq('due_on', item.id);
      if (error) setError(error.message);
    } else {
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, done, done_at } : i)));
      await supabase
        .from(item.source === 'todo' ? 'website_todos' : 'tasks')
        .update({ done, done_at })
        .eq('id', item.id);
    }
    await load();
    onChange?.();
  }

  // Only personal to-dos can be deleted. Contact tasks never had a delete
  // anywhere in the app, and this doesn't add one.
  async function remove(item: Item) {
    if (item.source !== 'todo') return;
    await supabase.from('website_todos').delete().eq('id', item.id);
    await load();
    onChange?.();
  }

  // Reminders in the list: anything overdue since they started, plus the
  // next one coming up. Ticked ones come from reminder_checks, so one ticked
  // early from the calendar still lands in Completed.
  const openReminders = loaded
    ? REMINDERS.flatMap((r) => occurrencesThroughNext(r, today).map((day) => reminderItem(r, day))).filter((i) => !i.done)
    : [];
  const doneReminders = Object.keys(checks).flatMap((k) => {
    const [key, day] = k.split('|');
    const reminder = findReminder(key);
    return reminder ? [reminderItem(reminder, day)] : [];
  });

  const open = [...items.filter((i) => !i.done), ...openReminders].sort(byDueThenCreated);
  const done = [...items.filter((i) => i.done), ...doneReminders]
    .filter((i) => !completedLongAgo(i))
    .sort(byDueThenCreated);

  const itemsOn = (day: string) => [
    ...items.filter((i) => i.due_date === day).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    // Held back until loaded so a reminder never flashes up without its clients.
    ...(loaded ? remindersOn(day).map((r) => reminderItem(r, day)) : []),
  ];

  return { loaded, error, today, open, done, itemsOn, add, toggle, remove };
}
