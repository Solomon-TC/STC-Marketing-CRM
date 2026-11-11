'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isIntake = pathname.startsWith('/intake');
  const hideNav = pathname === '/login' || isIntake;

  return (
    <>
      {/* Soft colored light for the glass panels to blur. Left off the
          client-facing intake page, which stays matched to the public site. */}
      {!isIntake && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[38rem] w-[38rem] rounded-full bg-pineLight/45 blur-[140px]" />
          <div className="absolute left-1/3 -top-56 h-[26rem] w-[30rem] rounded-full bg-lime-300/10 blur-[140px]" />
          <div className="absolute -right-32 top-1/4 h-[34rem] w-[34rem] rounded-full bg-tan/35 blur-[150px]" />
          <div className="absolute -bottom-48 left-1/4 h-[30rem] w-[40rem] rounded-full bg-pine/45 blur-[150px]" />
          <div className="absolute -bottom-32 right-0 h-[24rem] w-[28rem] rounded-full bg-orange-500/15 blur-[140px]" />
        </div>
      )}
      {!hideNav && <Navbar />}
      <main className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </>
  );
}
