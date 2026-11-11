'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { contactDisplayName } from '@/lib/types';
import { dayKey, parseDay, shiftDay } from '@/lib/dates';
import {
  findReminder,
  occurrencesThroughNext,
  REMINDERS,
  remindersOn,
  type Reminder,
  type ReminderKey,
} from '@/lib/reminders';

// One list over two existing tables, with nothing moved between them:
//  - website_todos: personal to-dos, added here (and deletable here)
//  - tasks: tasks tied to a contact, still added from that contact's page
// plus the recurring reminders from lib/reminders.ts, whose tick-offs live in
// reminder_checks. Each item remembers where it came from, so ticking it
// updates only that row in that table.
//
// Completed items stay listed for 5 days after they were checked off, then
// drop off the page. Nothing is deleted -- the rows stay in the database,
// and unticking within the 5 days brings an item straight back.
//
// The calendar on the right shows every dated item plus the reminders.
type Item = {
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

type Client = { id: string; business_name: string; stage: string };

const HIDE_COMPLETED_AFTER_DAYS = 5;

// Done long enough ago to drop off the page. Items with no recorded
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

export default function TodoPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [checks, setChecks] = useState<Record<string, string>>({}); // checkKey -> done_at
  const [clients, setClients] = useState<Client[]>([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(() => dayKey(new Date()));
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 8) + '01');
  const titleRef = useRef<HTMLInputElement>(null);

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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from('website_todos').insert({ title: title.trim(), due_date: dueDate || null });
    if (error) {
      setError(error.message);
      return;
    }
    setTitle('');
    setDueDate('');
    load();
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
    load();
  }

  // Only personal to-dos can be deleted here. Contact tasks never had a
  // delete anywhere in the app, and this doesn't add one.
  async function remove(item: Item) {
    if (item.source !== 'todo') return;
    await supabase.from('website_todos').delete().eq('id', item.id);
    load();
  }

  function addOnDay(day: string) {
    setDueDate(day);
    titleRef.current?.focus();
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
    ...remindersOn(day).map((r) => reminderItem(r, day)),
  ];
  const selectedItems = itemsOn(selected);

  const rowProps = (item: Item) => ({
    item,
    today,
    onToggle: () => toggle(item),
    onRemove: () => remove(item),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">To-Do</h1>
        <p className="text-sm text-fog">
          {open.length} open · your to-dos, tasks linked to contacts, and recurring reminders
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* List */}
        <div className="min-w-0 space-y-6">
          <form onSubmit={add} className="card flex flex-wrap gap-2 sm:flex-nowrap">
            <input
              ref={titleRef}
              className="input min-w-0 flex-1 basis-full sm:basis-auto"
              placeholder="Add a to-do..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="date"
              aria-label="Due date (optional)"
              title="Due date (optional)"
              className="input w-auto flex-1 sm:flex-none"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <button type="submit" className="btn-primary shrink-0">
              Add
            </button>
          </form>

          {error && <p className="text-sm text-warn">{error}</p>}

          <div className="card divide-y divide-white/[0.06] p-0">
            {loaded && open.length === 0 && <p className="p-5 text-sm text-mist">Nothing to do.</p>}
            {open.map((item) => (
              <Row key={item.key} {...rowProps(item)} />
            ))}
          </div>

          {done.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-mist">
                Completed{' '}
                <span className="normal-case tracking-normal">· clears {HIDE_COMPLETED_AFTER_DAYS} days after checking off</span>
              </h2>
              <div className="card divide-y divide-white/[0.06] p-0">
                {done.map((item) => (
                  <Row key={item.key} {...rowProps(item)} />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-mist">
            To add a task linked to a contact, open the contact (Tools → Contacts) and add it there.
          </p>
        </div>

        {/* Calendar */}
        <div className="min-w-0 space-y-6">
          <Calendar
            month={month}
            today={today}
            selected={selected}
            itemsOn={itemsOn}
            onSelect={setSelected}
            onMonth={setMonth}
          />
          <div className="card p-0">
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
              <h2 className="text-sm font-medium">
                {parseDay(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              <button type="button" onClick={() => addOnDay(selected)} className="btn-secondary shrink-0 whitespace-nowrap text-xs">
                + Add to-do this day
              </button>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {selectedItems.length === 0 && <p className="px-5 pb-4 text-sm text-mist">Nothing on this day.</p>}
              {selectedItems.map((item) => (
                <Row key={item.key} {...rowProps(item)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reminder colors, used on both the calendar and the list badges.
const REMINDER_STYLE: Record<ReminderKey, { pill: string; dot: string; chip: string }> = {
  client_update: { pill: 'bg-amber-300/15 text-amber-200', dot: 'bg-amber-300', chip: 'chip-amber' },
  maintenance_check: { pill: 'bg-cyan-300/15 text-cyan-200', dot: 'bg-cyan-300', chip: 'chip-cyan' },
};

function Row({
  item,
  today,
  onToggle,
  onRemove,
}: {
  item: Item;
  today: string;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const overdue = !item.done && item.due_date !== null && item.due_date < today;
  return (
    <div className="px-5 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <label className="flex min-w-0 items-center gap-3">
          <input type="checkbox" checked={item.done} onChange={onToggle} />
          <span className={item.done ? 'text-mist line-through' : ''}>{item.title}</span>
        </label>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          {item.reminder && <span className={REMINDER_STYLE[item.reminder.key].chip}>{item.reminder.schedule}</span>}
          {item.contact && (
            <Link href={`/contacts/${item.contact.id}`} className="chip-glass hover:bg-white/15">
              {contactDisplayName(item.contact)}
            </Link>
          )}
          {item.due_date && <span className={overdue ? 'text-warn' : 'text-mist'}>{item.due_date}</span>}
          {item.source === 'todo' && (
            <button onClick={onRemove} className="text-mist hover:text-warn hover:underline">
              Delete
            </button>
          )}
        </div>
      </div>
      {item.reminder && !item.done && (
        <div className="mt-1.5 space-y-2 pl-7">
          <p className="text-xs text-mist">{item.note}</p>
          {item.clients && item.clients.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {item.clients.map((c) => (
                <Link key={c.id} href={`/websites/${c.id}`} className="chip-glass text-[11px] hover:bg-white/15">
                  {c.business_name}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mist">No clients in that stage right now.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Calendar({
  month,
  today,
  selected,
  itemsOn,
  onSelect,
  onMonth,
}: {
  month: string; // 'YYYY-MM-01'
  today: string;
  selected: string;
  itemsOn: (day: string) => Item[];
  onSelect: (day: string) => void;
  onMonth: (month: string) => void;
}) {
  const first = parseDay(month);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const start = shiftDay(month, -first.getDay()); // the Sunday on or before the 1st
  const days = Array.from({ length: weeks * 7 }, (_, i) => shiftDay(start, i));
  const monthOffset = (n: number) => dayKey(new Date(first.getFullYear(), first.getMonth() + n, 1));

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl">
          {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1.5">
          <CalButton label="Previous month" onClick={() => onMonth(monthOffset(-1))}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
          </CalButton>
          <button
            type="button"
            onClick={() => {
              onMonth(today.slice(0, 8) + '01');
              onSelect(today);
            }}
            className="h-8 rounded-full border border-white/15 px-3 text-xs text-fog transition hover:bg-white/10 hover:text-paper"
          >
            Today
          </button>
          <CalButton label="Next month" onClick={() => onMonth(monthOffset(1))}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
          </CalButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-mist">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="pb-1">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const dayItems = itemsOn(day);
          const isToday = day === today;
          const isSelected = day === selected;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              className={`flex min-h-[3.5rem] min-w-0 flex-col gap-1 rounded-xl border p-1 text-left transition sm:min-h-[6rem] sm:p-1.5 ${
                isSelected
                  ? 'border-pineLight/60 bg-white/[0.09]'
                  : 'border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.06]'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  isToday ? 'bg-pineLight font-medium text-ink' : 'text-fog'
                }`}
              >
                {parseDay(day).getDate()}
              </span>

              {/* Phones: dots. Wider: labelled pills. */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {dayItems.slice(0, 4).map((i) => (
                  <span
                    key={i.key}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i.reminder ? REMINDER_STYLE[i.reminder.key].dot : 'bg-paper/70'
                    } ${i.done ? 'opacity-40' : ''}`}
                  />
                ))}
              </span>
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {dayItems.slice(0, 3).map((i) => (
                  <span
                    key={i.key}
                    title={i.title}
                    className={`truncate rounded-md px-1.5 py-0.5 text-[10px] leading-tight ${
                      i.reminder ? REMINDER_STYLE[i.reminder.key].pill : 'bg-white/10 text-paper'
                    } ${i.done ? 'line-through opacity-50' : ''}`}
                  >
                    {i.title}
                  </span>
                ))}
                {dayItems.length > 3 && <span className="px-1 text-[10px] text-mist">+{dayItems.length - 3} more</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-mist">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-paper/70" /> To-dos &amp; tasks
        </span>
        {REMINDERS.map((r) => (
          <span key={r.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${REMINDER_STYLE[r.key].dot}`} /> {r.title} ·{' '}
            {r.key === 'client_update' ? '2nd Wednesday' : 'every Wednesday'}
          </span>
        ))}
      </div>
    </section>
  );
}

function CalButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-fog transition hover:bg-white/10 hover:text-paper"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        {children}
      </svg>
    </button>
  );
}
