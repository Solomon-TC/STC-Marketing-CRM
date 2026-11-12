'use client';

import { useRef, useState } from 'react';
import { HIDE_COMPLETED_AFTER_DAYS, useTodoData } from '@/lib/useTodoData';
import { Calendar, DayPanel, TodoRow } from '@/components/TodoCalendar';

// The To-Do page: the combined list (left) and the calendar (right). Data
// and the rules for what shows where live in lib/useTodoData.ts, shared with
// the Dashboard calendar.
export default function TodoPage() {
  const { loaded, error, today, open, done, itemsOn, add, toggle, remove } = useTodoData();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 8) + '01');
  const titleRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (await add(title, dueDate)) {
      setTitle('');
      setDueDate('');
    }
  }

  function addOnDay(day: string) {
    setDueDate(day);
    titleRef.current?.focus();
  }

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
          <form onSubmit={submit} className="card flex flex-wrap gap-2 sm:flex-nowrap">
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
              <TodoRow key={item.key} item={item} today={today} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
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
                  <TodoRow
                    key={item.key}
                    item={item}
                    today={today}
                    onToggle={() => toggle(item)}
                    onRemove={() => remove(item)}
                  />
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
          <DayPanel
            day={selected}
            items={itemsOn(selected)}
            today={today}
            onToggle={toggle}
            onRemove={remove}
            action={
              <button
                type="button"
                onClick={() => addOnDay(selected)}
                className="btn-secondary shrink-0 whitespace-nowrap text-xs"
              >
                + Add to-do this day
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}
