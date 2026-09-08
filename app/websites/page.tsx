'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { WebsiteClient } from '@/lib/types';
import { WEBSITE_CLIENT_STAGES, WEBSITE_CLIENT_STAGE_COLORS, daysSince } from '@/lib/types';

// The Website Build Pipeline: a Kanban board over website_clients, the
// independent build-tracking table (see supabase/add_website_clients.sql).
// Not linked to the sales-side Deal/WebsiteDeal pipelines at all.
export default function WebsitesPipelinePage() {
  const supabase = createClient();
  const [clients, setClients] = useState<WebsiteClient[]>([]);
  const [thresholdDays, setThresholdDays] = useState(5);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('website_clients').select('*').order('created_at', { ascending: false }),
      supabase.from('website_pipeline_settings').select('stuck_threshold_days').eq('id', 1).single(),
    ]);
    setClients(c ?? []);
    if (s) setThresholdDays(s.stuck_threshold_days);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateThreshold(days: number) {
    setThresholdDays(days);
    await supabase.from('website_pipeline_settings').update({ stuck_threshold_days: days }).eq('id', 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Website Build Pipeline</h1>
          <p className="text-sm text-fog">
            {clients.length} {clients.length === 1 ? 'client' : 'clients'} in the build process
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'New client'}
        </button>
      </div>

      {showForm && (
        <NewClientForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {WEBSITE_CLIENT_STAGES.map((stage) => {
          const stageClients = clients.filter((c) => c.stage === stage.value);
          const colors = WEBSITE_CLIENT_STAGE_COLORS[stage.value];
          return (
            <div key={stage.value} className="w-64 shrink-0">
              <div
                className={`mb-2 flex items-center justify-between rounded-md border px-2 py-1.5 ${colors.header}`}
              >
                <h3 className={`text-sm font-medium ${colors.text}`}>{stage.label}</h3>
                <span className={`text-xs ${colors.count}`}>{stageClients.length}</span>
              </div>
              <div className="space-y-2">
                {stageClients.map((client) => (
                  <ClientCard key={client.id} client={client} thresholdDays={thresholdDays} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex w-fit items-center gap-2 text-xs text-mist">
        <label htmlFor="stuck-threshold">Flag as stuck after</label>
        <input
          id="stuck-threshold"
          type="number"
          min={1}
          className="w-14 rounded-md border border-white/10 bg-charcoal px-2 py-1 text-xs outline-none focus:border-pineLight focus:ring-1 focus:ring-pineLight"
          value={thresholdDays}
          onChange={(e) => updateThreshold(Math.max(1, Number(e.target.value) || 1))}
        />
        <span>days in the same stage</span>
      </div>
    </div>
  );
}

function ClientCard({ client, thresholdDays }: { client: WebsiteClient; thresholdDays: number }) {
  const days = daysSince(client.stage_changed_at);
  // Maintenance is meant to hold a client indefinitely -- that's the whole
  // point of the stage, not a sign anything's stuck.
  const stuck = client.stage !== 'maintenance' && days >= thresholdDays;

  return (
    <Link
      href={`/websites/${client.id}`}
      className={`card block hover:border-white/15 ${stuck ? 'border-warn/40' : ''}`}
    >
      <p className="text-sm font-medium">{client.business_name}</p>
      <p className="mt-1 text-xs text-mist">
        {days} {days === 1 ? 'day' : 'days'} in this stage
      </p>
      {stuck && <p className="mt-1 text-xs font-medium text-warn">⚠ Stuck</p>}
    </Link>
  );
}

function NewClientForm({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    date_closed: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: client, error: insertError } = await supabase
      .from('website_clients')
      .insert({
        business_name: form.business_name,
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        date_closed: form.date_closed || null,
      })
      .select()
      .single();

    if (insertError || !client) {
      setSaving(false);
      setError(insertError?.message ?? 'Something went wrong.');
      return;
    }

    // Snapshot the current active checklist templates onto this client, so
    // editing the template later never rewrites an existing client's
    // checklist history.
    const { data: templates } = await supabase
      .from('website_checklist_templates')
      .select('category, label, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (templates && templates.length > 0) {
      await supabase.from('website_client_checklist_items').insert(
        templates.map((t) => ({
          website_client_id: client.id,
          category: t.category,
          label: t.label,
          sort_order: t.sort_order,
        }))
      );
    }

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="card grid gap-3 sm:grid-cols-2">
      <input
        className="input"
        placeholder="Business name"
        required
        value={form.business_name}
        onChange={(e) => setForm({ ...form, business_name: e.target.value })}
      />
      <input
        className="input"
        placeholder="Contact name"
        value={form.contact_name}
        onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
      />
      <input
        className="input"
        placeholder="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        className="input"
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <div>
        <label className="mb-1 block text-xs text-mist">Date closed</label>
        <input
          className="input"
          type="date"
          value={form.date_closed}
          onChange={(e) => setForm({ ...form, date_closed: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-warn sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save client'}
        </button>
      </div>
    </form>
  );
}
