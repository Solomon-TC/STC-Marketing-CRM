import { createClient } from '@supabase/supabase-js';

// Service-role client -- bypasses Row Level Security entirely. Never import
// this from a Client Component or anything that ships to the browser; it
// only belongs in Server Components / Server Actions. Today its only caller
// is app/intake/[token]/page.tsx, since that's the one page in this app
// that has to work for a signed-out visitor -- RLS on every table denies
// the anon role outright (see supabase/harden_rls.sql), so a request with
// no session has no way to read or write website_clients otherwise.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
