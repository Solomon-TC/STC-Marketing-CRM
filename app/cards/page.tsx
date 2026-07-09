'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Card, CardStatus } from '@/lib/types';
import { BREAK_EVEN_COST, formatCardMonth } from '@/lib/types';

const STATUS_BADGES: Record<CardStatus, string> = {
  filling: 'bg-orange-50 text-orange-700',
  ready: 'bg-green-50 text-green-700',
  sent: 'bg-blue-50 text-blue-700',
  archived: 'bg-black/5 text-ink/50',
};

const STATUS_LABELS: Record<CardStatus, string> = {
  filling: 'Filling',
  ready: 'Ready to Send',
  sent: 'Sent',
  archived: 'Archived',
};

function cardStats(card: Card) {
  const slots = card.card_slots ?? [];
  const filled = slots.filter((s) => s.status === 'filled');
  const revenue = filled.reduce((sum, s) => sum + s.price, 0);
  return {
    totalSlots: slots.length,
    filledCount: filled.length,
    revenue,
    profit: revenue - BREAK_EVEN_COST,
  };
}

export default function CardsPage() {
  const supabase = createClient();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'active' | 'past'>('active');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('cards')
      .select('*, card_slots(id, price, status)')
      .order('month', { ascending: false });
    setCards((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = cards.filter((c) => c.status === 'filling' || c.status === 'ready');
  const past = cards.filter((c) => c.status === 'sent' || c.status === 'archived');
  const visible = view === 'active' ? active : past;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Cards</h1>
          <p className="text-sm text-ink/60">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'} total
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'Add card'}
        </button>
      </div>

      {showForm && (
        <NewCardForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="flex gap-1">
        <button
          onClick={() => setView('active')}
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            view === 'active' ? 'bg-accentSoft font-medium text-accent' : 'text-ink/60 hover:bg-black/5'
          }`}
        >
          Active Cards
        </button>
        <button
          onClick={() => setView('past')}
          className={`rounded-md px-3 py-1.5 text-sm transition ${
            view === 'past' ? 'bg-accentSoft font-medium text-accent' : 'text-ink/60 hover:bg-black/5'
          }`}
        >
          Past Cards
        </button>
      </div>

      {loading && <p className="text-sm text-ink/50">Loading...</p>}

      {!loading && visible.length === 0 && (
        <p className="text-sm text-ink/50">
          {view === 'active' ? 'No active cards yet.' : 'No past cards yet.'}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) =>
          view === 'active' ? (
            <ActiveCardTile key={card.id} card={card} />
          ) : (
            <PastCardTile key={card.id} card={card} />
          )
        )}
      </div>
    </div>
  );
}

function ActiveCardTile({ card }: { card: Card }) {
  const { totalSlots, filledCount, revenue, profit } = cardStats(card);
  const pct = totalSlots > 0 ? Math.round((filledCount / totalSlots) * 100) : 0;

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-serif text-lg">{card.city}</p>
          <p className="text-xs text-ink/50">{formatCardMonth(card.month)}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[card.status]}`}>
          {STATUS_LABELS[card.status]}
        </span>
      </div>

      <div>
        <div className="h-2 rounded-full bg-black/5">
          <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink/50">
          {filledCount}/{totalSlots} slots filled
        </p>
      </div>

      <div className="text-xs text-ink/60">
        <p>
          Revenue: ${revenue.toLocaleString()}{' '}
          <span className="text-ink/40">/ ${BREAK_EVEN_COST.toLocaleString()} break-even</span>
        </p>
        <p className={profit >= 0 ? 'text-accent' : 'text-warn'}>
          Projected profit: {profit >= 0 ? '' : '-'}${Math.abs(profit).toLocaleString()}
        </p>
      </div>

      <Link href={`/cards/${card.id}`} className="btn-secondary inline-block text-sm">
        View card
      </Link>
    </div>
  );
}

function PastCardTile({ card }: { card: Card }) {
  const { filledCount, revenue, profit } = cardStats(card);

  return (
    <div className="card space-y-1">
      <div className="flex items-center justify-between">
        <p className="font-serif text-lg">{card.city}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[card.status]}`}>
          {STATUS_LABELS[card.status]}
        </span>
      </div>
      <p className="text-xs text-ink/50">{formatCardMonth(card.month)}</p>
      <p className="text-sm text-ink/70">Final revenue: ${revenue.toLocaleString()}</p>
      <p className={`text-sm ${profit >= 0 ? 'text-accent' : 'text-warn'}`}>
        Profit: {profit >= 0 ? '' : '-'}${Math.abs(profit).toLocaleString()}
      </p>
      <p className="text-xs text-ink/50">
        {filledCount} {filledCount === 1 ? 'business' : 'businesses'}
      </p>
      <Link href={`/cards/${card.id}`} className="mt-2 inline-block text-sm text-accent hover:underline">
        View card
      </Link>
    </div>
  );
}

function NewCardForm({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({ city: '', month: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('cards').insert({
      city: form.city,
      month: `${form.month}-01`,
      notes: form.notes || null,
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
        placeholder="City"
        required
        value={form.city}
        onChange={(e) => setForm({ ...form, city: e.target.value })}
      />
      <input
        className="input"
        type="month"
        required
        value={form.month}
        onChange={(e) => setForm({ ...form, month: e.target.value })}
      />
      <textarea
        className="input sm:col-span-2"
        placeholder="Notes"
        rows={2}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
      {error && <p className="text-sm text-warn sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save card'}
        </button>
      </div>
    </form>
  );
}
