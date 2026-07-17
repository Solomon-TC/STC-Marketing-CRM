'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Contact, Deal, DealStage } from '@/lib/types';
import { contactDisplayName, DEAL_STAGES, STAGE_TRANSITIONS, WON_OR_BETTER_STAGES } from '@/lib/types';
import ContactCombobox from '@/components/ContactCombobox';
import ContactNotesLog from '@/components/ContactNotesLog';

// Roughly matches the whiteboard process map: orange/pink for the lead
// stages, purple for the follow-up stages, green for won and the deeper
// green for fully fulfilled, and red for lost.
const STAGE_COLORS: Record<DealStage, { header: string; text: string; count: string }> = {
  warm_lead: { header: 'bg-orange-50 border-orange-200', text: 'text-orange-700', count: 'text-orange-400' },
  called_contacted: { header: 'bg-pink-50 border-pink-200', text: 'text-pink-700', count: 'text-pink-400' },
  requested_followup: { header: 'bg-purple-50 border-purple-200', text: 'text-purple-700', count: 'text-purple-400' },
  followed_up: { header: 'bg-violet-50 border-violet-200', text: 'text-violet-700', count: 'text-violet-400' },
  won: { header: 'bg-green-50 border-green-200', text: 'text-green-700', count: 'text-green-400' },
  fulfilled_obligation: { header: 'bg-green-100 border-green-300', text: 'text-green-800', count: 'text-green-500' },
  lost: { header: 'bg-red-50 border-red-200', text: 'text-red-700', count: 'text-red-400' },
};

export default function DealsPage() {
  const supabase = createClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [initialContactId, setInitialContactId] = useState<string | undefined>(undefined);
  const [industryFilter, setIndustryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  async function load() {
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase
        .from('deals')
        .select('*, contacts(id, company, location, industry)')
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').order('company'),
    ]);
    setDeals((d as any) ?? []);
    setContacts(c ?? []);
  }

  useEffect(() => {
    load();
    // Arriving from a contact's "Add to pipeline" button: open the form
    // pre-filled with that contact, then drop the param so a refresh doesn't
    // reopen it.
    const contactId = new URLSearchParams(window.location.search).get('contactId');
    if (contactId) {
      setInitialContactId(contactId);
      setShowForm(true);
      window.history.replaceState(null, '', '/deals');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveStage(deal: Deal, stage: DealStage) {
    await supabase.from('deals').update({ stage }).eq('id', deal.id);
    load();
  }

  async function deleteDeal(deal: Deal) {
    await supabase.from('deals').delete().eq('id', deal.id);
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
          <h1 className="font-serif text-2xl">Pipeline</h1>
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
                  <DealCard key={deal.id} deal={deal} onMove={moveStage} onDelete={deleteDeal} />
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

function DealCard({
  deal,
  onMove,
  onDelete,
}: {
  deal: Deal;
  onMove: (deal: Deal, stage: DealStage) => void;
  onDelete: (deal: Deal) => void;
}) {
  const [showManual, setShowManual] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const nextStages = STAGE_TRANSITIONS[deal.stage];
  const canAssignToCard =
    WON_OR_BETTER_STAGES.includes(deal.stage) && deal.value != null && !!deal.contacts?.location;

  return (
    <div className="card">
      <p className="text-sm font-medium">{deal.title}</p>
      {deal.contacts && <p className="text-xs text-ink/50">{contactDisplayName(deal.contacts)}</p>}
      {deal.value != null && (
        <p className="mt-1 text-xs text-ink/60">${Number(deal.value).toLocaleString()}</p>
      )}

      {canAssignToCard && <AssignmentStatus contactId={deal.contacts!.id} />}

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

// Read-only: whether this contact is linked to a slot on a currently active
// card. Scoped to active cards (not "ever assigned") so a repeat contact from
// a past, already-sent card still shows as unassigned until they're placed
// on a new one -- otherwise a returning customer's new deal would look
// already handled when it isn't.
// Assignment itself happens from the card's Slots table, not here.
function AssignmentStatus({ contactId }: { contactId: string }) {
  const supabase = createClient();
  const [assigned, setAssigned] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: activeCards } = await supabase.from('cards').select('id').in('status', ['filling', 'ready']);
      const activeCardIds = (activeCards ?? []).map((c) => c.id);
      if (activeCardIds.length === 0) {
        if (!cancelled) setAssigned(false);
        return;
      }
      const { data } = await supabase
        .from('card_slots')
        .select('id')
        .eq('contact_id', contactId)
        .in('card_id', activeCardIds)
        .limit(1);
      if (!cancelled) setAssigned((data?.length ?? 0) > 0);
    }
    check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  if (assigned === null) return null;

  return (
    <p className={`mt-2 text-xs font-medium ${assigned ? 'text-green-700' : 'text-red-700'}`}>
      {assigned ? 'Assigned to slot' : 'Not assigned to slot'}
    </p>
  );
}

function NewDealForm({
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
