'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MAIN_TABS } from '@/lib/nav';

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
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 lg:px-10">
      <div className="animate-fade-down mx-auto max-w-[1800px] rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_12px_40px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-serif text-lg text-pineLight">
              S
            </span>
            {/* Dropped on tablet widths (768-1023px), where the tab row needs the room. */}
            <span className="font-serif text-base text-paper md:hidden lg:inline">
              STC <span className="text-pineLight">Marketing</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-black/25 p-1 md:flex">
            {MAIN_TABS.map((tab) => {
              const active = tab.isActive(pathname);
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition ${
                    active
                      ? 'border border-white/10 bg-white/10 font-medium text-paper shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]'
                      : 'border border-transparent text-fog hover:text-paper'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={signOut}
            className="hidden shrink-0 rounded-full px-3 py-1.5 text-sm text-mist transition hover:bg-white/5 hover:text-paper md:block"
          >
            Sign out
          </button>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-fog hover:text-paper md:hidden"
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
          <nav className="animate-fade-down flex flex-col gap-0.5 border-t border-white/10 p-3 md:hidden">
            {MAIN_TABS.map((tab) => {
              const active = tab.isActive(pathname);
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-full px-3 py-2 text-sm transition ${
                    active ? 'bg-white/10 font-medium text-paper' : 'text-fog hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
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
