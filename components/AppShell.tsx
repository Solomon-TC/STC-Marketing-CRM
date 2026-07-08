'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === '/login';

  return (
    <>
      {!hideNav && <Navbar />}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
