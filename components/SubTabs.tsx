'use client';

import Link from 'next/link';
import type { NavTab } from '@/lib/nav';

// The pill switcher shown above the pages in a grouped tab (Pipelines, Tools).
export default function SubTabs({ tabs, activeHref }: { tabs: NavTab[]; activeHref: string }) {
  return (
    <div className="mb-6 overflow-x-auto">
      <nav className="inline-flex gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition ${
                active
                  ? 'border border-white/10 bg-pineLight font-medium text-ink'
                  : 'border border-transparent text-fog hover:text-paper'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
