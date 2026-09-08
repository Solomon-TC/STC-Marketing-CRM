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
  { href: '/websites/checklist-templates', label: 'Checklist Templates' },
  { href: '/websites/dns-reference', label: 'DNS Reference' },
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
    <header className="border-b border-white/10 bg-ink">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <span className="font-serif text-base text-paper">
            STC <span className="text-pineLight">Marketing</span> CRM
          </span>
          <nav className="hidden gap-0.5 sm:flex">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-pine/20 text-pineLight font-medium'
                      : 'text-fog hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <select
            aria-label="Switch view"
            className="input w-auto py-1 text-sm"
            value={mode}
            onChange={(e) => router.push(e.target.value === 'websites' ? '/websites' : '/')}
          >
            <option value="sales">Sales view</option>
            <option value="websites">Websites view</option>
          </select>
          <button onClick={signOut} className="text-sm text-mist hover:text-paper">
            Sign out
          </button>
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-full text-fog hover:bg-white/5 sm:hidden"
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
        <nav className="flex flex-col border-t border-white/10 px-4 py-2 sm:hidden">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-full px-3 py-2 text-sm transition ${
                  active ? 'bg-pine/20 text-pineLight font-medium' : 'text-fog hover:bg-white/5'
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
    </header>
  );
}
