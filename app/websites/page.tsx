'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { WebsiteClient, WebsiteClientStage } from '@/lib/types';
import { WEBSITE_CLIENT_STAGES, WEBSITE_CLIENT_STAGE_COLORS, boardStage, daysSince } from '@/lib/types';

// The Websites pipeline (website builds): a Kanban board over website_clients, the
// independent build-tracking table (see supabase/add_website_clients.sql).
// Not linked to the sales-side Deal/WebsiteDeal pipelines at all.
export default function WebsitesPipelinePage() {
  const supabase = createClient();
  const [clients, setClients] = useState<WebsiteClient[]>([]);
  const [thresholdDays, setThresholdDays] = useState(5);
  const [showForm, setShowForm] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<WebsiteClientStage | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Drag a client card onto another column to change its stage -- the same
  // single-field change as picking a new Stage on the client's page and
  // saving. stage_changed_at is reset by the database trigger, exactly as it
  // is for that save; nothing else on the client is touched.
  async function dropOnStage(stage: WebsiteClientStage) {
    const client = clients.find((c) => c.id === draggingId);
    setDraggingId(null);
    setDragOverStage(null);
    if (!client || client.stage === stage) return;
    // Move it locally first so the board responds instantly.
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, stage, stage_changed_at: new Date().toISOString() } : c))
    );
    const { error } = await supabase.from('website_clients').update({ stage }).eq('id', client.id);
    setError(error ? error.message : null);
    load();
  }

  async function updateThreshold(days: number) {
    setThresholdDays(days);
    await supabase.from('website_pipeline_settings').update({ stuck_threshold_days: days }).eq('id', 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Websites Pipeline</h1>
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

      {error && <p className="text-sm text-warn">{error}</p>}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {WEBSITE_CLIENT_STAGES.map((stage) => {
          const stageClients = clients.filter((c) => boardStage(c.stage) === stage.value);
          const colors = WEBSITE_CLIENT_STAGE_COLORS[stage.value];
          return (
            <div
              key={stage.value}
              className={`w-72 shrink-0 rounded-3xl border border-white/10 p-2.5 backdrop-blur-xl transition ${
                draggingId && dragOverStage === stage.value
                  ? 'bg-white/[0.08] ring-1 ring-pineLight/60'
                  : 'bg-white/[0.03]'
              }`}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStage !== stage.value) setDragOverStage(stage.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOnStage(stage.value);
              }}
            >
              <div
                className={`mb-3 flex items-center justify-between rounded-full border px-3 py-1.5 ${colors.header}`}
              >
                <h3 className={`text-sm font-medium ${colors.text}`}>{stage.label}</h3>
                <span className={`text-xs ${colors.count}`}>{stageClients.length}</span>
              </div>
              <div className="min-h-[6rem] space-y-2">
                {stageClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    thresholdDays={thresholdDays}
                    dragging={draggingId === client.id}
                    onDragStart={() => setDraggingId(client.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStage(null);
                    }}
                  />
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

function ClientCard({
  client,
  thresholdDays,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  client: WebsiteClient;
  thresholdDays: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const days = daysSince(client.stage_changed_at);
  // Maintenance is meant to hold a client indefinitely -- that's the whole
  // point of the stage, not a sign anything's stuck.
  const stuck = client.stage !== 'maintenance' && days >= thresholdDays;

  return (
    // Still a link: a click opens the client; a drag moves it between stages.
    <Link
      href={`/websites/${client.id}`}
      className={`tile block cursor-grab active:cursor-grabbing ${stuck ? 'border-warn/50' : ''} ${
        dragging ? 'opacity-40' : ''
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', client.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <p className="text-sm font-medium">{client.business_name}</p>
      <p className="mt-1 text-xs text-mist">
        {days} {days === 1 ? 'day' : 'days'} in this stage
      </p>
      {/* The intake form was sent back (this used to be the Info Received column). */}
      {boardStage(client.stage) === 'intake' && client.intake_submitted_at && (
        <span className="chip-lime mt-2">Info received</span>
      )}
      {(client.build_fee != null || client.monthly_fee != null) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {client.build_fee != null && (
            <span className="chip-glass">${Number(client.build_fee).toLocaleString()} build</span>
          )}
          {client.monthly_fee != null && (
            <span className="chip-glass">${Number(client.monthly_fee).toLocaleString()}/mo</span>
          )}
        </div>
      )}
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
    build_fee: '',
    monthly_fee: '',
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
        // Set explicitly: the column's database default is the retired 'new'.
        stage: 'intake',
        build_fee: form.build_fee ? Number(form.build_fee) : null,
        monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-mist">Build fee ($)</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={form.build_fee}
            onChange={(e) => setForm({ ...form, build_fee: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-mist">Monthly fee ($/mo)</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={form.monthly_fee}
            onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
          />
        </div>
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
