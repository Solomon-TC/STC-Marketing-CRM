'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Contact, Deal, DealStage } from '@/lib/types';
import { contactDisplayName, DEAL_STAGES, formatCardMonth, STAGE_TRANSITIONS } from '@/lib/types';
import ContactCombobox from '@/components/ContactCombobox';

// Roughly matches the whiteboard process map: blue/orange/pink for the lead
// stages, purple for the follow-up stages, a green shade per money-in-motion
// stage after "won", and red for lost.
const STAGE_COLORS: Record<DealStage, { header: string; text: string; count: string }> = {
  cold_lead: { header: 'bg-blue-50 border-blue-200', text: 'text-blue-700', count: 'text-blue-400' },
  warm_lead: { header: 'bg-orange-50 border-orange-200', text: 'text-orange-700', count: 'text-orange-400' },
  called_contacted: { header: 'bg-pink-50 border-pink-200', text: 'text-pink-700', count: 'text-pink-400' },
  requested_followup: { header: 'bg-purple-50 border-purple-200', text: 'text-purple-700', count: 'text-purple-400' },
  followed_up: { header: 'bg-violet-50 border-violet-200', text: 'text-violet-700', count: 'text-violet-400' },
  won: { header: 'bg-green-50 border-green-200', text: 'text-green-700', count: 'text-green-400' },
  invoice_sent: { header: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', count: 'text-emerald-400' },
  payment_received: { header: 'bg-teal-50 border-teal-200', text: 'text-teal-700', count: 'text-teal-400' },
  ad_made: { header: 'bg-lime-50 border-lime-200', text: 'text-lime-700', count: 'text-lime-500' },
  ad_confirmed: { header: 'bg-green-100 border-green-300', text: 'text-green-800', count: 'text-green-500' },
  lost: { header: 'bg-red-50 border-red-200', text: 'text-red-700', count: 'text-red-400' },
};

export default function DealsPage() {
  const supabase = createClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [initialContactId, setInitialContactId] = useState<string | undefined>(undefined);

  async function load() {
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase
        .from('deals')
        .select('*, contacts(id, name, company, location)')
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').order('name'),
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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage.value);
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
                  <DealCard key={deal.id} deal={deal} onMove={moveStage} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  onMove,
}: {
  deal: Deal;
  onMove: (deal: Deal, stage: DealStage) => void;
}) {
  const [showManual, setShowManual] = useState(false);
  const nextStages = STAGE_TRANSITIONS[deal.stage];
  const canAssignToCard = deal.stage === 'won' && deal.value != null && !!deal.contacts?.location;

  return (
    <div className="card">
      <p className="text-sm font-medium">{deal.title}</p>
      {deal.contacts && <p className="text-xs text-ink/50">{contactDisplayName(deal.contacts)}</p>}
      {deal.value != null && (
        <p className="mt-1 text-xs text-ink/60">${Number(deal.value).toLocaleString()}</p>
      )}

      {canAssignToCard && <AssignToCardControl deal={deal} />}

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
            onMove(deal, e.target.value as DealStage);
            setShowManual(false);
          }}
        >
          {DEAL_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

type MatchingSlot = {
  id: string;
  slot_type: string;
  price: number;
  card: { id: string; city: string; month: string };
};

// Won deals with a contact location can be manually linked to an open slot
// on an active card for that city -- never auto-assigned, per spec.
function AssignToCardControl({ deal }: { deal: Deal }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<MatchingSlot[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    const opening = !open;
    setOpen(opening);
    if (opening && slots === null) {
      setLoading(true);
      const location = (deal.contacts?.location ?? '').trim().toLowerCase();
      const { data: activeCards } = await supabase
        .from('cards')
        .select('id, city, month, status')
        .in('status', ['filling', 'ready']);
      const matchingCards = (activeCards ?? []).filter((c) => {
        const city = c.city.trim().toLowerCase();
        return city.length > 0 && (location.includes(city) || city.includes(location));
      });
      if (matchingCards.length === 0) {
        setSlots([]);
      } else {
        const { data: openSlots } = await supabase
          .from('card_slots')
          .select('id, card_id, slot_type, price')
          .eq('status', 'open')
          .in(
            'card_id',
            matchingCards.map((c) => c.id)
          );
        const withCard: MatchingSlot[] = (openSlots ?? []).map((s: any) => ({
          id: s.id,
          slot_type: s.slot_type,
          price: s.price,
          card: matchingCards.find((c) => c.id === s.card_id)!,
        }));
        setSlots(withCard);
      }
      setLoading(false);
    }
  }

  async function assign(slotId: string) {
    const businessName = contactDisplayName(deal.contacts!);
    await supabase
      .from('card_slots')
      .update({ business_name: businessName, contact_id: deal.contacts!.id, status: 'filled' })
      .eq('id', slotId);
    setSlots((prev) => prev?.filter((s) => s.id !== slotId) ?? null);
    setMessage(`Assigned to ${businessName}'s card slot.`);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="rounded-md bg-accentSoft px-2 py-1 text-[11px] font-medium text-accent hover:bg-accentSoft/70"
      >
        {open ? 'Hide card slots' : 'Assign to card slot'}
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-black/10 bg-white p-2 text-xs">
          {loading && <p className="text-ink/40">Loading open slots...</p>}
          {!loading && slots?.length === 0 && (
            <p className="text-ink/40">No open slots on an active card in this city.</p>
          )}
          {!loading &&
            slots?.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => assign(s.id)}
                className="block w-full rounded px-1.5 py-1 text-left hover:bg-black/5"
              >
                {s.card.city} · {formatCardMonth(s.card.month)} · {s.slot_type} (${s.price})
              </button>
            ))}
          {message && <p className="mt-1 text-accent">{message}</p>}
        </div>
      )}
    </div>
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
