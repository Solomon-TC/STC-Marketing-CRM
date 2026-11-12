'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTodoData } from '@/lib/useTodoData';
import { Calendar, DayPanel } from '@/components/TodoCalendar';

// The To-Do calendar at the bottom of the Dashboard -- same calendar and data
// as the To-Do page. Items can be ticked off from the day panel; adding and
// deleting stay on the To-Do page.
export default function DashboardCalendar() {
  const router = useRouter();
  // Refresh the server-rendered Dashboard panels (e.g. its To-Do list)
  // after a tick-off here.
  const { today, itemsOn, toggle, error } = useTodoData(() => router.refresh());
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 8) + '01');

  const openTodo = (
    <Link
      href="/todo"
      aria-label="Open To-Do"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-fog transition hover:bg-white/10 hover:text-paper"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8">
        <Calendar
          month={month}
          today={today}
          selected={selected}
          itemsOn={itemsOn}
          onSelect={setSelected}
          onMonth={setMonth}
          action={openTodo}
        />
      </div>
      <div className="min-w-0 space-y-3 lg:col-span-4">
        <DayPanel day={selected} items={itemsOn(selected)} today={today} onToggle={toggle} />
        {error && <p className="text-sm text-warn">{error}</p>}
      </div>
    </div>
  );
}
