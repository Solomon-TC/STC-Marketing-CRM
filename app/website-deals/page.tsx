'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Contact, DealStage, WebsiteDeal } from '@/lib/types';
import { contactDisplayName, DEAL_STAGES, STAGE_COLORS, STAGE_TRANSITIONS } from '@/lib/types';
import ContactCombobox from '@/components/ContactCombobox';
import ContactNotesLog from '@/components/ContactNotesLog';

// The Websites Pipeline: same stages, contacts, and card-style layout as the
// Spotlights Pipeline (app/deals/page.tsx), but backed by its own
// website_deals table, tracking two dollar amounts instead of one, and with
// no link to the Cards system.
export default function WebsiteDealsPage() {
  const supabase = createClient();
  const [deals, setDeals] = useState<WebsiteDeal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [initialContactId, setInitialContactId] = useState<string | undefined>(undefined);
  const [industryFilter, setIndustryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  async function load() {
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase
        .from('website_deals')
        .select('*, contacts(id, company, location, industry)')
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').order('company'),
    ]);
    setDeals((d as any) ?? []);
    setContacts(c ?? []);
  }

  useEffect(() => {
    load();
    // Same convenience pattern as the Spotlights pipeline: a contactId query
    // param opens the form pre-filled, then gets dropped so a refresh
    // doesn't reopen it. Nothing links here today, but kept for parity.
    const contactId = new URLSearchParams(window.location.search).get('contactId');
    if (contactId) {
      setInitialContactId(contactId);
      setShowForm(true);
      window.history.replaceState(null, '', '/website-deals');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveStage(deal: WebsiteDeal, stage: DealStage) {
    await supabase.from('website_deals').update({ stage }).eq('id', deal.id);
    load();
  }

  async function deleteDeal(deal: WebsiteDeal) {
    await supabase.from('website_deals').delete().eq('id', deal.id);
    load();
  }

  const industries = useMemo(
    () => Array.from(new Set(deals.map((d) => d.contacts?.industry).filter(Boolean))) as string[],
    [deals]
  );
  const locations = useMemo(
    () => Array.from(new Set(deals.map((d) => d.contacts?.location).filter(Boolean))) as string[],
    [deals]
  );

  const filteredDeals = deals.filter((d) => {
    const matchesIndustry = industryFilter === 'all' || d.contacts?.industry === industryFilter;
    const matchesLocation = locationFilter === 'all' || d.contacts?.location === locationFilter;
    return matchesIndustry && matchesLocation;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Websites Pipeline</h1>
          <p className="text-sm text-ink/60">
            {deals.length} {deals.length === 1 ? 'deal' : 'deals'} across your pipeline
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'Add deal'}
        </button>
      </div>

      {showForm && (
        <NewWebsiteDealForm
          contacts={contacts}
          initialContactId={initialContactId}
          onCreated={() => {
            setShowForm(false);
            setInitialContactId(undefined);
            load();
          }}
        />
      )}

      <div className="card flex flex-wrap gap-3">
        <select
          className="input max-w-[180px]"
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
        >
          <option value="all">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[180px]"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        >
          <option value="all">All locations</option>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = filteredDeals.filter((d) => d.stage === stage.value);
          const colors = STAGE_COLORS[stage.value];
          return (
            <div key={stage.value} className="w-64 shrink-0">
              <div
                className={`mb-2 flex items-center justify-between rounded-md border px-2 py-1.5 ${colors.header}`}
              >
                <h3 className={`text-sm font-medium ${colors.text}`}>{stage.label}</h3>
                <span className={`text-xs ${colors.count}`}>{stageDeals.length}</span>
              </div>
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <WebsiteDealCard
                    key={deal.id}
                    deal={deal}
                    contacts={contacts}
                    onMove={moveStage}
                    onDelete={deleteDeal}
                    onUpdated={load}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DELETE_OPTION = '__delete__';

function WebsiteDealCard({
  deal,
  contacts,
  onMove,
  onDelete,
  onUpdated,
}: {
  deal: WebsiteDeal;
  contacts: Contact[];
  onMove: (deal: WebsiteDeal, stage: DealStage) => void;
  onDelete: (deal: WebsiteDeal) => void;
  onUpdated: () => void;
}) {
  const [showManual, setShowManual] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const nextStages = STAGE_TRANSITIONS[deal.stage];

  return (
    <div className="card">
      <p className="text-sm font-medium">{deal.title}</p>
      {deal.contacts && <p className="text-xs text-ink/50">{contactDisplayName(deal.contacts)}</p>}
      {deal.initial_value != null && (
        <p className="mt-1 text-xs text-ink/60">Initial: ${Number(deal.initial_value).toLocaleString()}</p>
      )}
      {deal.recurring_value != null && (
        <p className="text-xs text-ink/60">
          Recurring: ${Number(deal.recurring_value).toLocaleString()}/mo
        </p>
      )}

      {deal.contacts && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="text-[11px] text-ink/40 hover:text-ink/60 hover:underline"
          >
            {showNotes ? 'Hide notes' : 'Notes'}
          </button>
          {showNotes && (
            <div className="mt-1 rounded-md border border-black/10 p-2">
              <ContactNotesLog contactId={deal.contacts.id} />
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowEdit((v) => !v)}
        className="mt-2 block text-[11px] text-ink/40 hover:text-ink/60 hover:underline"
      >
        {showEdit ? 'Cancel edit' : 'Edit deal'}
      </button>

      {showEdit && (
        <EditWebsiteDealForm
          deal={deal}
          contacts={contacts}
          onSaved={() => {
            setShowEdit(false);
            onUpdated();
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {nextStages.length > 0 && (
        <select
          className="input mt-2 text-xs"
          value=""
          onChange={(e) => {
            if (e.target.value) onMove(deal, e.target.value as DealStage);
          }}
        >
          <option value="">Move to...</option>
          {nextStages.map((stageValue) => {
            const s = DEAL_STAGES.find((d) => d.value === stageValue)!;
            return (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            );
          })}
        </select>
      )}

      <button
        type="button"
        onClick={() => setShowManual((v) => !v)}
        className="mt-2 block text-[11px] text-ink/40 hover:text-ink/60 hover:underline"
      >
        {showManual ? 'Cancel' : 'Correct stage manually'}
      </button>

      {showManual && (
        <select
          className="input mt-1 text-xs"
          value={deal.stage}
          onChange={(e) => {
            if (e.target.value === DELETE_OPTION) {
              if (confirm(`Delete "${deal.title}"? This can't be undone.`)) {
                onDelete(deal);
              }
              return;
            }
            onMove(deal, e.target.value as DealStage);
            setShowManual(false);
          }}
        >
          {DEAL_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          <option value={DELETE_OPTION}>Delete deal</option>
        </select>
      )}
    </div>
  );
}

function EditWebsiteDealForm({
  deal,
  contacts,
  onSaved,
  onCancel,
}: {
  deal: WebsiteDeal;
  contacts: Contact[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title: deal.title,
    contact_id: deal.contact_id ?? '',
    initial_value: deal.initial_value != null ? String(deal.initial_value) : '',
    recurring_value: deal.recurring_value != null ? String(deal.recurring_value) : '',
    expected_close_date: deal.expected_close_date ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('website_deals')
      .update({
        title: form.title,
        contact_id: form.contact_id || null,
        initial_value: form.initial_value ? Number(form.initial_value) : null,
        recurring_value: form.recurring_value ? Number(form.recurring_value) : null,
        expected_close_date: form.expected_close_date || null,
      })
      .eq('id', deal.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 space-y-2 rounded-md border border-black/10 p-2">
      <input
        className="input text-xs"
        placeholder="Deal title"
        required
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <ContactCombobox
        contacts={contacts}
        value={form.contact_id}
        onChange={(contactId) => setForm({ ...form, contact_id: contactId })}
      />
      <input
        className="input text-xs"
        placeholder="Initial Value ($)"
        type="number"
        value={form.initial_value}
        onChange={(e) => setForm({ ...form, initial_value: e.target.value })}
      />
      <input
        className="input text-xs"
        placeholder="Recurring Value ($/mo)"
        type="number"
        value={form.recurring_value}
        onChange={(e) => setForm({ ...form, recurring_value: e.target.value })}
      />
      <input
        className="input text-xs"
        type="date"
        value={form.expected_close_date}
        onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
      />
      {error && <p className="text-xs text-warn">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary text-xs">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewWebsiteDealForm({
  contacts,
  initialContactId,
  onCreated,
}: {
  contacts: Contact[];
  initialContactId?: string;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title: '',
    contact_id: initialContactId ?? '',
    stage: 'warm_lead' as DealStage,
    initial_value: '',
    recurring_value: '',
    expected_close_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('website_deals').insert({
      title: form.title,
      contact_id: form.contact_id || null,
      stage: form.stage,
      initial_value: form.initial_value ? Number(form.initial_value) : null,
      recurring_value: form.recurring_value ? Number(form.recurring_value) : null,
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
      <ContactCombobox
        contacts={contacts}
        value={form.contact_id}
        onChange={(contactId) => setForm({ ...form, contact_id: contactId })}
      />
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
        type="date"
        value={form.expected_close_date}
        onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
      />
      <input
        className="input"
        placeholder="Initial Value ($)"
        type="number"
        value={form.initial_value}
        onChange={(e) => setForm({ ...form, initial_value: e.target.value })}
      />
      <input
        className="input"
        placeholder="Recurring Value ($/mo)"
        type="number"
        value={form.recurring_value}
        onChange={(e) => setForm({ ...form, recurring_value: e.target.value })}
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
