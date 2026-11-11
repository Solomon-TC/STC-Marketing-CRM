'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Existing CRM pages your brother uses daily -- unchanged.
const SALES_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/deals', label: 'Spotlights Pipeline' },
  { href: '/website-deals', label: 'Websites Pipeline' },
  { href: '/cards', label: 'Cards' },
  { href: '/finances', label: 'Finances' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/import', label: 'Import' },
];

// The website-build tracking pages, shown only in "Websites" view.
const WEBSITES_LINKS = [
  { href: '/websites', label: 'Pipeline' },
  { href: '/websites/todo', label: 'To-Do' },
  { href: '/websites/checklist-templates', label: 'Checklist Templates' },
  { href: '/websites/dns-reference', label: 'DNS Reference' },
  { href: '/websites/build-prompt', label: 'Initial Build Prompt' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  // Derived from the URL rather than stored anywhere -- whatever page
  // you're actually on decides which nav shows, so a refresh or a direct
  // link always renders correctly with no flash of the wrong nav.
  const mode: 'sales' | 'websites' = pathname.startsWith('/websites') ? 'websites' : 'sales';
  const links = mode === 'websites' ? WEBSITES_LINKS : SALES_LINKS;

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1800px] rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_12px_40px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <Link href={mode === 'websites' ? '/websites' : '/'} className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-serif text-lg text-pineLight">
              S
            </span>
            {/* Hidden only in the 1280-1535px range, where the full link row
                needs the room. */}
            <span className="font-serif text-base text-paper xl:hidden 2xl:inline">
              STC <span className="text-pineLight">Marketing</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-black/25 p-1 xl:flex">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                    active
                      ? 'border border-white/10 bg-white/10 font-medium text-paper shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]'
                      : 'border border-transparent text-fog hover:text-paper'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            <select
              aria-label="Switch view"
              className="input w-auto rounded-full bg-white/[0.06] py-1.5"
              value={mode}
              onChange={(e) => router.push(e.target.value === 'websites' ? '/websites' : '/')}
            >
              <option value="sales">Sales view</option>
              <option value="websites">Websites view</option>
            </select>
            <button
              onClick={signOut}
              className="rounded-full px-3 py-1.5 text-sm text-mist transition hover:bg-white/5 hover:text-paper"
            >
              Sign out
            </button>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-fog hover:text-paper xl:hidden"
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-0.5 border-t border-white/10 p-3 xl:hidden">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-full px-3 py-2 text-sm transition ${
                    active ? 'bg-white/10 font-medium text-paper' : 'text-fog hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <select
              aria-label="Switch view"
              className="input mt-1"
              value={mode}
              onChange={(e) => {
                setMenuOpen(false);
                router.push(e.target.value === 'websites' ? '/websites' : '/');
              }}
            >
              <option value="sales">Sales view</option>
              <option value="websites">Websites view</option>
            </select>
            <button
              onClick={signOut}
              className="mt-1 rounded-full px-3 py-2 text-left text-sm text-mist hover:bg-white/5"
            >
              Sign out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
