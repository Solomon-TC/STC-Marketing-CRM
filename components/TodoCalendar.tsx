'use client';

import Link from 'next/link';
import { contactDisplayName } from '@/lib/types';
import { dayKey, parseDay, shiftDay } from '@/lib/dates';
import { REMINDERS, type ReminderKey } from '@/lib/reminders';
import type { Item } from '@/lib/useTodoData';

// The To-Do pieces shared by the To-Do page and the Dashboard: a list row,
// the month calendar, and the selected-day panel.

// Reminder colors, used on both the calendar and the list badges.
const REMINDER_STYLE: Record<ReminderKey, { pill: string; dot: string; chip: string }> = {
  client_update: { pill: 'bg-amber-300/15 text-amber-200', dot: 'bg-amber-300', chip: 'chip-amber' },
  maintenance_check: { pill: 'bg-cyan-300/15 text-cyan-200', dot: 'bg-cyan-300', chip: 'chip-cyan' },
};

// onRemove is optional: without it, no Delete link is shown (the Dashboard
// doesn't offer deleting).
export function TodoRow({
  item,
  today,
  onToggle,
  onRemove,
}: {
  item: Item;
  today: string;
  onToggle: () => void;
  onRemove?: () => void;
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
          {item.source === 'todo' && onRemove && (
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

export function DayPanel({
  day,
  items,
  today,
  action,
  onToggle,
  onRemove,
}: {
  day: string;
  items: Item[];
  today: string;
  action?: React.ReactNode;
  onToggle: (item: Item) => void;
  onRemove?: (item: Item) => void;
}) {
  return (
    <div className="card p-0">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <h2 className="text-sm font-medium">
          {parseDay(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>
        {action}
      </div>
      <div className="divide-y divide-white/[0.06]">
        {items.length === 0 && <p className="px-5 pb-4 text-sm text-mist">Nothing on this day.</p>}
        {items.map((item) => (
          <TodoRow
            key={item.key}
            item={item}
            today={today}
            onToggle={() => onToggle(item)}
            onRemove={onRemove ? () => onRemove(item) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function Calendar({
  month,
  today,
  selected,
  itemsOn,
  onSelect,
  onMonth,
  action,
}: {
  month: string; // 'YYYY-MM-01'
  today: string;
  selected: string;
  itemsOn: (day: string) => Item[];
  onSelect: (day: string) => void;
  onMonth: (month: string) => void;
  action?: React.ReactNode;
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
          {action}
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
