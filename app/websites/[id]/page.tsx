'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { WebsiteClient } from '@/lib/types';
import { WEBSITE_CLIENT_STAGES } from '@/lib/types';

// Placeholder detail view -- full checklist, intake summary, etc. land here
// next. For now, just enough to confirm the Pipeline Dashboard's cards link
// to the right client and the stage can be moved.
export default function WebsiteClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [client, setClient] = useState<WebsiteClient | null>(null);

  async function load() {
    const { data } = await supabase.from('website_clients').select('*').eq('id', id).single();
    setClient(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!client) {
    return <p className="text-sm text-ink/50">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-accent hover:underline">
        &larr; Back to pipeline
      </button>

      <div>
        <h1 className="font-serif text-2xl">{client.business_name}</h1>
        <p className="text-sm text-ink/60">
          {client.contact_name ?? 'No contact name'} {client.email ? `· ${client.email}` : ''}{' '}
          {client.phone ? `· ${client.phone}` : ''}
        </p>
      </div>

      <div className="card">
        <label className="mb-1 block text-xs text-ink/50">Stage</label>
        <select
          className="input max-w-xs"
          value={client.stage}
          onChange={async (e) => {
            await supabase.from('website_clients').update({ stage: e.target.value }).eq('id', client.id);
            load();
          }}
        >
          {WEBSITE_CLIENT_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <p className="text-sm text-ink/50">
          Checklist, intake summary, and the rest of the client detail view are coming next.
        </p>
      </div>
    </div>
  );
}
