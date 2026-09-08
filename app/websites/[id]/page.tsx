'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { WebsiteClient, WebsiteClientChecklistItem } from '@/lib/types';
import { WEBSITE_CLIENT_STAGES, SUGGESTED_WEBSITE_SCOPE_TAGS, formatNoteTimestamp } from '@/lib/types';

export default function WebsiteClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [client, setClient] = useState<WebsiteClient | null>(null);
  const [checklist, setChecklist] = useState<WebsiteClientChecklistItem[]>([]);
  const [form, setForm] = useState<{
    business_name: string;
    contact_name: string;
    email: string;
    phone: string;
    stage: string;
    date_closed: string;
    service_area: string;
    scope_tags: string;
    live_domain: string;
    maintenance_status: string;
    notes: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const [{ data: c }, { data: items }] = await Promise.all([
      supabase.from('website_clients').select('*').eq('id', id).single(),
      supabase
        .from('website_client_checklist_items')
        .select('*')
        .eq('website_client_id', id)
        .order('sort_order', { ascending: true }),
    ]);
    setClient(c);
    setChecklist(items ?? []);
    if (c) {
      setForm({
        business_name: c.business_name,
        contact_name: c.contact_name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        stage: c.stage,
        date_closed: c.date_closed ?? '',
        service_area: c.service_area ?? '',
        scope_tags: (c.scope_tags ?? []).join(', '),
        live_domain: c.live_domain ?? '',
        maintenance_status: c.maintenance_status,
        notes: c.notes ?? '',
      });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from('website_clients')
      .update({
        business_name: form.business_name,
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        stage: form.stage,
        date_closed: form.date_closed || null,
        service_area: form.service_area || null,
        scope_tags: form.scope_tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        live_domain: form.live_domain || null,
        maintenance_status: form.maintenance_status,
        notes: form.notes || null,
      })
      .eq('id', id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  async function handleDelete() {
    if (!client) return;
    if (!confirm(`Delete "${client.business_name}"? This can't be undone.`)) return;
    await supabase.from('website_clients').delete().eq('id', client.id);
    router.push('/websites');
  }

  async function toggleChecklistItem(item: WebsiteClientChecklistItem) {
    const done = !item.done;
    await supabase
      .from('website_client_checklist_items')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', item.id);
    load();
  }

  const checklistByCategory = useMemo(() => {
    const groups: Record<string, WebsiteClientChecklistItem[]> = {};
    for (const item of checklist) {
      (groups[item.category] ??= []).push(item);
    }
    return groups;
  }, [checklist]);

  function copySummary() {
    if (!client) return;
    const lines: string[] = [`${client.business_name} -- intake summary`, ''];
    const section = (label: string, value: string | null) => {
      if (value) lines.push(`${label}:`, value, '');
    };
    section('Business description', client.intake_business_description);
    section('Services offered', client.intake_services);
    section('Service area details', client.intake_service_area_details);
    section('Key selling points', client.intake_selling_points);
    section('Competitor / inspiration sites', client.intake_inspiration_urls);
    section('Other notes from client', client.intake_other_notes);
    if (lines.length <= 2) lines.push('(No intake information submitted yet.)');
    navigator.clipboard
      .writeText(lines.join('\n'))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError('Could not copy to clipboard.'));
  }

  if (!client || !form) {
    return <p className="text-sm text-ink/50">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/websites')} className="text-sm text-accent hover:underline">
          &larr; Back to pipeline
        </button>
        <button onClick={handleDelete} className="text-sm text-warn hover:underline">
          Delete client
        </button>
      </div>

      <div>
        <h1 className="font-serif text-2xl">{client.business_name}</h1>
        <p className="text-sm text-ink/60">
          Stage-changed {formatNoteTimestamp(client.stage_changed_at)} · Created{' '}
          {formatNoteTimestamp(client.created_at)}
        </p>
      </div>

      <form onSubmit={handleSave} className="card grid gap-3 sm:grid-cols-2">
        <Field label="Business name" full>
          <input
            className="input"
            required
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </Field>
        <Field label="Contact name">
          <input
            className="input"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Stage">
          <select
            className="input"
            value={form.stage}
            onChange={(e) => setForm({ ...form, stage: e.target.value })}
          >
            {WEBSITE_CLIENT_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date closed">
          <input
            className="input"
            type="date"
            value={form.date_closed}
            onChange={(e) => setForm({ ...form, date_closed: e.target.value })}
          />
        </Field>
        <Field label="Service area">
          <input
            className="input"
            value={form.service_area}
            onChange={(e) => setForm({ ...form, service_area: e.target.value })}
          />
        </Field>
        <Field label="Live domain">
          <input
            className="input"
            placeholder="example.com"
            value={form.live_domain}
            onChange={(e) => setForm({ ...form, live_domain: e.target.value })}
          />
        </Field>
        <Field label="Maintenance">
          <select
            className="input"
            value={form.maintenance_status}
            onChange={(e) => setForm({ ...form, maintenance_status: e.target.value })}
          >
            <option value="inactive">Inactive</option>
            <option value="active">Active</option>
          </select>
        </Field>
        <Field label={`Scope tags (comma-separated -- e.g. ${SUGGESTED_WEBSITE_SCOPE_TAGS.join(', ')})`} full>
          <input
            className="input"
            value={form.scope_tags}
            onChange={(e) => setForm({ ...form, scope_tags: e.target.value })}
          />
        </Field>
        <Field label="Notes" full>
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {error && <p className="text-sm text-warn sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium">Checklist</h2>
        {checklist.length === 0 && <p className="text-sm text-ink/50">No checklist items on this client.</p>}
        <div className="space-y-4">
          {Object.entries(checklistByCategory).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink/40">{category}</h3>
              <div className="space-y-1">
                {items.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item)} />
                    <span className={item.done ? 'text-ink/40 line-through' : ''}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Intake</h2>
          <button type="button" onClick={copySummary} className="btn-secondary text-xs">
            {copied ? 'Copied!' : 'Copy formatted summary'}
          </button>
        </div>
        {client.intake_submitted_at ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-ink/50">Submitted {formatNoteTimestamp(client.intake_submitted_at)}</p>
            <IntakeField label="Business description" value={client.intake_business_description} />
            <IntakeField label="Services offered" value={client.intake_services} />
            <IntakeField label="Service area details" value={client.intake_service_area_details} />
            <IntakeField label="Key selling points" value={client.intake_selling_points} />
            <IntakeField label="Competitor / inspiration sites" value={client.intake_inspiration_urls} />
            <IntakeField label="Other notes from client" value={client.intake_other_notes} />
          </div>
        ) : (
          <p className="text-sm text-ink/50">
            Not yet submitted. The client intake form isn&apos;t built yet -- coming next.
          </p>
        )}
      </div>
    </div>
  );
}

function IntakeField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-ink/50">{label}</p>
      <p className="whitespace-pre-wrap text-ink/80">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs text-ink/50">{label}</label>
      {children}
    </div>
  );
}
