'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === '/login';

  return (
    <>
      {!hideNav && <Navbar />}
      <main className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </>
  );
}
