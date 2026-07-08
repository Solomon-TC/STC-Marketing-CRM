'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Contact, Deal, DealStage } from '@/lib/types';
import { contactDisplayName, DEAL_STAGES } from '@/lib/types';

export default function DealsPage() {
  const supabase = createClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase
        .from('deals')
        .select('*, contacts(id, name, company)')
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').order('name'),
    ]);
    setDeals((d as any) ?? []);
    setContacts(c ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveStage(deal: Deal, stage: DealStage) {
    await supabase.from('deals').update({ stage }).eq('id', deal.id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Pipeline</h1>
          <p className="text-sm text-ink/60">
            {deals.length} {deals.length === 1 ? 'deal' : 'deals'} across your pipeline
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'Add deal'}
        </button>
      </div>

      {showForm && (
        <NewDealForm
          contacts={contacts}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage.value);
          return (
            <div key={stage.value} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">{stage.label}</h3>
                <span className="text-xs text-ink/40">{stageDeals.length}</span>
              </div>
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <div key={deal.id} className="card">
                    <p className="text-sm font-medium">{deal.title}</p>
                    {deal.contacts && (
                      <p className="text-xs text-ink/50">{contactDisplayName(deal.contacts)}</p>
                    )}
                    {deal.value != null && (
                      <p className="mt-1 text-xs text-ink/60">
                        ${Number(deal.value).toLocaleString()}
                      </p>
                    )}
                    <select
                      className="input mt-2 text-xs"
                      value={deal.stage}
                      onChange={(e) => moveStage(deal, e.target.value as DealStage)}
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewDealForm({
  contacts,
  onCreated,
}: {
  contacts: Contact[];
  onCreated: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title: '',
    contact_id: '',
    stage: 'cold_lead' as DealStage,
    value: '',
    expected_close_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('deals').insert({
      title: form.title,
      contact_id: form.contact_id || null,
      stage: form.stage,
      value: form.value ? Number(form.value) : null,
      expected_close_date: form.expected_close_date || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="card grid gap-3 sm:grid-cols-2">
      <input
        className="input"
        placeholder="Deal title"
        required
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <select
        className="input"
        value={form.contact_id}
        onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
      >
        <option value="">No linked contact</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {contactDisplayName(c)}
          </option>
        ))}
      </select>
      <select
        className="input"
        value={form.stage}
        onChange={(e) => setForm({ ...form, stage: e.target.value as DealStage })}
      >
        {DEAL_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        className="input"
        placeholder="Value ($)"
        type="number"
        value={form.value}
        onChange={(e) => setForm({ ...form, value: e.target.value })}
      />
      <input
        className="input"
        type="date"
        value={form.expected_close_date}
        onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
      />
      {error && <p className="text-sm text-warn sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save deal'}
        </button>
      </div>
    </form>
  );
}
