'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Card, CardSlot, Contact, SlotType } from '@/lib/types';
import {
  BREAK_EVEN_COST,
  CARD_STATUSES,
  citiesMatch,
  contactDisplayName,
  formatCardMonth,
  SLOT_TYPES,
  WON_OR_BETTER_STAGES,
} from '@/lib/types';
import ContactCombobox from '@/components/ContactCombobox';

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [card, setCard] = useState<Card | null>(null);
  const [slots, setSlots] = useState<CardSlot[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [wonContactIds, setWonContactIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [showAddSlot, setShowAddSlot] = useState(false);

  async function load() {
    const [{ data: c }, { data: s }, { data: ct }, { data: wonDeals }] = await Promise.all([
      supabase.from('cards').select('*').eq('id', id).single(),
      supabase.from('card_slots').select('*').eq('card_id', id).order('created_at', { ascending: true }),
      supabase.from('contacts').select('*').order('name'),
      supabase.from('deals').select('contact_id').in('stage', WON_OR_BETTER_STAGES),
    ]);
    setCard(c);
    setNotes(c?.notes ?? '');
    setSlots(s ?? []);
    setContacts(ct ?? []);
    setWonContactIds(new Set((wonDeals ?? []).map((d) => d.contact_id).filter((v): v is string => !!v)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateCard(patch: Partial<Card>) {
    if (!card) return;
    setCard({ ...card, ...patch });
    await supabase.from('cards').update(patch).eq('id', card.id);
  }

  async function saveNotes() {
    if (!card || notes === (card.notes ?? '')) return;
    await updateCard({ notes: notes || null });
  }

  async function markAsSent() {
    if (!card) return;
    if (!confirm(`Mark the ${card.city} card as sent? This moves it to Past Cards.`)) return;
    await updateCard({ status: 'sent' });
  }

  async function archiveCard() {
    if (!card) return;
    await updateCard({ status: 'archived' });
  }

  async function updateSlot(slotId: string, patch: Partial<CardSlot>) {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, ...patch } : s)));
    await supabase.from('card_slots').update(patch).eq('id', slotId);
  }

  async function deleteSlot(slotId: string) {
    if (!confirm('Delete this open slot?')) return;
    await supabase.from('card_slots').delete().eq('id', slotId);
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  async function addSlot(form: {
    slot_type: SlotType;
    business_name: string;
    contact_id: string;
    status: 'open' | 'filled';
  }) {
    const price = SLOT_TYPES.find((t) => t.value === form.slot_type)!.price;
    const { data } = await supabase
      .from('card_slots')
      .insert({
        card_id: id,
        slot_type: form.slot_type,
        price,
        business_name: form.business_name || null,
        contact_id: form.contact_id || null,
        status: form.status,
      })
      .select()
      .single();
    if (data) setSlots((prev) => [...prev, data as CardSlot]);
    setShowAddSlot(false);
  }

  if (!card) {
    return <p className="text-sm text-ink/50">Loading...</p>;
  }

  const filledSlots = slots.filter((s) => s.status === 'filled');
  const revenue = filledSlots.reduce((sum, s) => sum + s.price, 0);
  const profit = revenue - BREAK_EVEN_COST;
  const pctBreakEven = Math.round((revenue / BREAK_EVEN_COST) * 100);

  // Only contacts in this card's city with a Won-or-better deal are offered
  // when adding a new slot -- keeps slot assignment scoped to real prospects
  // for this mailer instead of the whole contact list.
  const eligibleContacts = contacts.filter(
    (c) => wonContactIds.has(c.id) && citiesMatch(c.location, card.city)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/cards" className="text-sm text-accent hover:underline">
            &larr; Back to cards
          </Link>
          <h1 className="mt-1 font-serif text-2xl">{card.city}</h1>
          <p className="text-sm text-ink/60">{formatCardMonth(card.month)}</p>
        </div>
        <div className="flex items-center gap-3">
          {card.status !== 'sent' && card.status !== 'archived' && (
            <button onClick={markAsSent} className="btn-secondary text-sm">
              Mark as Sent
            </button>
          )}
          {card.status !== 'archived' && (
            <button onClick={archiveCard} className="text-sm text-ink/50 hover:text-ink hover:underline">
              Archive
            </button>
          )}
        </div>
      </div>

      <div className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-ink/60">Status</label>
          <select
            className="input"
            value={card.status}
            onChange={(e) => updateCard({ status: e.target.value as Card['status'] })}
          >
            {CARD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-ink/60">Notes</label>
          <textarea
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium">Financial summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-ink/50">Revenue</p>
            <p className="mt-1 text-xl font-medium">${revenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50">Cost</p>
            <p className="mt-1 text-xl font-medium">${BREAK_EVEN_COST.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50">Profit/loss</p>
            <p className={`mt-1 text-xl font-medium ${profit >= 0 ? 'text-accent' : 'text-warn'}`}>
              {profit >= 0 ? '' : '-'}${Math.abs(profit).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink/50">Break-even covered</p>
            <p className="mt-1 text-xl font-medium">{pctBreakEven}%</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Slots</h2>
          <button className="btn-secondary text-sm" onClick={() => setShowAddSlot((v) => !v)}>
            {showAddSlot ? 'Close' : 'Add slot'}
          </button>
        </div>

        {showAddSlot && <AddSlotForm contacts={eligibleContacts} onAdd={addSlot} />}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 text-left text-ink/50">
              <tr>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Size</th>
                <th className="px-2 py-2 font-medium">Price</th>
                <th className="px-2 py-2 font-medium">Business</th>
                <th className="px-2 py-2 font-medium">Contact</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 && (
                <tr>
                  <td className="px-2 py-4 text-ink/50" colSpan={7}>
                    No slots yet. Add one above.
                  </td>
                </tr>
              )}
              {slots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  contacts={contacts}
                  onUpdate={(patch) => updateSlot(slot.id, patch)}
                  onDelete={() => deleteSlot(slot.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  contacts,
  onUpdate,
  onDelete,
}: {
  slot: CardSlot;
  contacts: Contact[];
  onUpdate: (patch: Partial<CardSlot>) => void;
  onDelete: () => void;
}) {
  const [businessName, setBusinessName] = useState(slot.business_name ?? '');
  const typeInfo = SLOT_TYPES.find((t) => t.value === slot.slot_type)!;

  function saveBusinessName() {
    if (businessName !== (slot.business_name ?? '')) {
      onUpdate({ business_name: businessName || null });
    }
  }

  function handleContactChange(contactId: string) {
    const patch: Partial<CardSlot> = { contact_id: contactId || null };
    if (contactId && !businessName) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        const name = contactDisplayName(contact);
        setBusinessName(name);
        patch.business_name = name;
      }
    }
    onUpdate(patch);
  }

  return (
    <tr className="border-b border-black/5 last:border-0">
      <td className="px-2 py-2">{typeInfo.label}</td>
      <td className="px-2 py-2 text-ink/60">{typeInfo.dimensions}</td>
      <td className="px-2 py-2 text-ink/60">${slot.price}</td>
      <td className="px-2 py-2">
        <input
          className="input"
          placeholder="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          onBlur={saveBusinessName}
        />
      </td>
      <td className="px-2 py-2">
        <ContactCombobox contacts={contacts} value={slot.contact_id ?? ''} onChange={handleContactChange} />
      </td>
      <td className="px-2 py-2">
        <select
          className="input"
          value={slot.status}
          onChange={(e) => onUpdate({ status: e.target.value as CardSlot['status'] })}
        >
          <option value="open">Open</option>
          <option value="filled">Filled</option>
        </select>
      </td>
      <td className="px-2 py-2">
        {slot.status === 'open' && (
          <button onClick={onDelete} className="text-xs text-warn hover:underline">
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

function AddSlotForm({
  contacts,
  onAdd,
}: {
  contacts: Contact[];
  onAdd: (form: {
    slot_type: SlotType;
    business_name: string;
    contact_id: string;
    status: 'open' | 'filled';
  }) => void;
}) {
  const [slotType, setSlotType] = useState<SlotType>('half');
  const [businessName, setBusinessName] = useState('');
  const [contactId, setContactId] = useState('');
  const [status, setStatus] = useState<'open' | 'filled'>('open');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({ slot_type: slotType, business_name: businessName, contact_id: contactId, status });
    setBusinessName('');
    setContactId('');
    setStatus('open');
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 grid gap-3 rounded-md border border-black/10 p-3 sm:grid-cols-2">
      <select className="input" value={slotType} onChange={(e) => setSlotType(e.target.value as SlotType)}>
        {SLOT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label} · {t.dimensions} · ${t.price}
          </option>
        ))}
      </select>
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'filled')}>
        <option value="open">Open</option>
        <option value="filled">Filled</option>
      </select>
      <input
        className="input"
        placeholder="Business name (optional)"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
      />
      <div>
        <ContactCombobox contacts={contacts} value={contactId} onChange={setContactId} />
        <p className="mt-1 text-xs text-ink/40">
          Only showing contacts in this city with a Won-or-better deal.
        </p>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary">
          Add slot
        </button>
      </div>
    </form>
  );
}
