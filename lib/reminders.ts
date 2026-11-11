import { parseDay, shiftDay } from './dates';

// Recurring To-Do reminders. Their dates are worked out here from the
// calendar -- nothing is stored per occurrence except a tick-off row in
// reminder_checks (reminder + due_on) once one is done.

export type ReminderKey = 'client_update' | 'maintenance_check';

export interface Reminder {
  key: ReminderKey;
  title: string;
  note: string;
  schedule: string;
  // Which website clients the reminder is about.
  clientStages: string[];
  occursOn: (d: Date) => boolean;
}

// Reminders start counting from the day they were added, so the To-Do list
// doesn't open with a backlog of every past Wednesday.
export const REMINDERS_START = '2026-11-11';

const isWednesday = (d: Date) => d.getDay() === 3;

export const REMINDERS: Reminder[] = [
  {
    key: 'client_update',
    title: 'Client update',
    note: 'Send each current client an update on their analytics and ask if they need anything.',
    schedule: 'Monthly',
    clientStages: ['live', 'maintenance'],
    // The 2nd Wednesday always falls on the 8th-14th.
    occursOn: (d) => isWednesday(d) && d.getDate() >= 8 && d.getDate() <= 14,
  },
  {
    key: 'maintenance_check',
    title: 'Maintenance check',
    note: 'Update and review checks on each website in Maintenance.',
    schedule: 'Weekly',
    clientStages: ['maintenance'],
    occursOn: isWednesday,
  },
];

export function findReminder(key: string) {
  return REMINDERS.find((r) => r.key === key);
}

export function remindersOn(day: string) {
  if (day < REMINDERS_START) return [];
  const d = parseDay(day);
  return REMINDERS.filter((r) => r.occursOn(d));
}

// Every occurrence of a reminder from REMINDERS_START up to and including
// its next one on or after today -- i.e. anything overdue plus what's next.
export function occurrencesThroughNext(reminder: Reminder, today: string) {
  const out: string[] = [];
  for (let day = REMINDERS_START; ; day = shiftDay(day, 1)) {
    if (reminder.occursOn(parseDay(day))) {
      out.push(day);
      if (day >= today) return out;
    }
    if (day > shiftDay(today, 62)) return out; // safety net; never reached
  }
}
