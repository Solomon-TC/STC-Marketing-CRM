'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/deals', label: 'Pipeline' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/import', label: 'Import' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-serif text-base">STC Marketing CRM</span>
          <nav className="hidden gap-1 sm:flex">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-accentSoft text-accent font-medium'
                      : 'text-ink/70 hover:bg-black/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={signOut}
          className="hidden text-sm text-ink/60 hover:text-ink sm:block"
        >
          Sign out
        </button>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink/70 hover:bg-black/5 sm:hidden"
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
        <nav className="flex flex-col border-t border-black/10 px-4 py-2 sm:hidden">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-3 py-2 text-sm transition ${
                  active ? 'bg-accentSoft text-accent font-medium' : 'text-ink/70 hover:bg-black/5'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="mt-1 rounded-md px-3 py-2 text-left text-sm text-ink/60 hover:bg-black/5"
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
