'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// The Dashboard's daily "posted on social media" check. Each checked day is
// one row in social_posts keyed by the local date, so a new day simply has
// no row yet -- the box starts unchecked every morning without anything
// having to reset it. Unchecking removes only today's row.

// Local calendar date as YYYY-MM-DD (the browser's time zone, so the box
// clears at local midnight rather than UTC midnight).
function dayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDay(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

const HISTORY_DAYS = 60;

export default function SocialPostCard() {
  const supabase = createClient();
  const [today, setToday] = useState(() => dayKey(new Date()));
  const [posted, setPosted] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('social_posts')
      .select('posted_on')
      .gte('posted_on', shiftDay(dayKey(new Date()), -HISTORY_DAYS));
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setPosted(new Set((data ?? []).map((r) => r.posted_on as string)));
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // Roll over to the new day if the dashboard is left open past midnight,
    // and pick up a check made on another device when coming back to the tab.
    const tick = setInterval(() => setToday(dayKey(new Date())), 60_000);
    const onFocus = () => {
      setToday(dayKey(new Date()));
      load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(tick);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const postedToday = posted.has(today);

  async function toggle() {
    const next = !postedToday;
    // Flip it locally first so the check responds instantly.
    setPosted((prev) => {
      const s = new Set(prev);
      if (next) s.add(today);
      else s.delete(today);
      return s;
    });
    const { error } = next
      ? await supabase.from('social_posts').upsert({ posted_on: today }, { onConflict: 'posted_on', ignoreDuplicates: true })
      : await supabase.from('social_posts').delete().eq('posted_on', today);
    if (error) setError(error.message);
    load();
  }

  // Consecutive days posted, counting back from today (or from yesterday if
  // today isn't checked yet, so the streak doesn't look broken all morning).
  let streak = 0;
  for (let d = postedToday ? today : shiftDay(today, -1); posted.has(d); d = shiftDay(d, -1)) streak++;

  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const [ty, tm, td] = today.split('-').map(Number);
  const todayLabel = new Date(ty, tm - 1, td).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Social media</h2>
        {loaded && (postedToday ? <span className="chip-lime">Posted</span> : <span className="chip-amber">Not yet</span>)}
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={!loaded}
        aria-pressed={postedToday}
        className={`mt-4 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
          postedToday
            ? 'border-lime-300/30 bg-lime-300/10 hover:bg-lime-300/15'
            : 'border-white/[0.07] bg-white/[0.045] hover:bg-white/[0.08]'
        }`}
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
            postedToday ? 'bg-lime-300 text-ink' : 'border-2 border-white/20 text-transparent'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span>
          <span className="block font-medium">{postedToday ? 'Posted today' : 'Post on social media today'}</span>
          <span className="block text-xs text-mist">{todayLabel}</span>
        </span>
      </button>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-medium tracking-tight">{streak}</p>
          <p className="text-[11px] text-fog">day streak</p>
        </div>
        <div className="flex gap-1.5">
          {week.map((d) => {
            const [y, m, dd] = d.split('-').map(Number);
            const date = new Date(y, m - 1, dd);
            const done = posted.has(d);
            return (
              <div key={d} className="flex flex-col items-center gap-1" title={`${date.toLocaleDateString()}: ${done ? 'posted' : 'not posted'}`}>
                <span
                  className={`h-6 w-6 rounded-full ${
                    done ? 'bg-lime-300' : 'border border-white/10 bg-white/[0.05]'
                  } ${d === today ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-transparent' : ''}`}
                />
                <span className="text-[10px] text-mist">{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-warn">{error}</p>}
    </section>
  );
}
