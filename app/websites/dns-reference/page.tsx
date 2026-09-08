'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DnsReferenceGuide } from '@/lib/types';

// A small internal reference, not tied to any client -- editable over time
// as new registrars/scenarios come up. Same table (dns_reference_guides)
// backs it; see supabase/add_website_clients.sql.
export default function DnsReferencePage() {
  const supabase = createClient();
  const [guides, setGuides] = useState<DnsReferenceGuide[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('dns_reference_guides')
      .select('*')
      .order('sort_order', { ascending: true });
    setGuides(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">DNS / Registrar Reference</h1>
          <p className="text-sm text-ink/60">Step-by-step notes for pointing a domain at a new site.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'Add guide'}
        </button>
      </div>

      {showForm && (
        <NewGuideForm
          nextSortOrder={guides.length > 0 ? Math.max(...guides.map((g) => g.sort_order)) + 1 : 1}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {guides.length === 0 && !showForm && (
        <p className="text-sm text-ink/50">No guides yet. Add one to get started.</p>
      )}

      <div className="space-y-3">
        {guides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function GuideCard({ guide, onChanged }: { guide: DnsReferenceGuide; onChanged: () => void }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ registrar: guide.registrar, steps: guide.steps });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('dns_reference_guides')
      .update({ registrar: form.registrar, steps: form.steps })
      .eq('id', guide.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${guide.registrar}" guide? This can't be undone.`)) return;
    await supabase.from('dns_reference_guides').delete().eq('id', guide.id);
    onChanged();
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="card space-y-3">
        <input
          className="input"
          required
          value={form.registrar}
          onChange={(e) => setForm({ ...form, registrar: e.target.value })}
        />
        <textarea
          className="input"
          rows={8}
          required
          value={form.steps}
          onChange={(e) => setForm({ ...form, steps: e.target.value })}
        />
        {error && <p className="text-sm text-warn">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">{guide.registrar}</h2>
        <div className="flex gap-3 text-xs">
          <button onClick={() => setEditing(true)} className="text-ink/50 hover:text-ink hover:underline">
            Edit
          </button>
          <button onClick={handleDelete} className="text-warn hover:underline">
            Delete
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink/80">{guide.steps}</p>
    </div>
  );
}

function NewGuideForm({ nextSortOrder, onCreated }: { nextSortOrder: number; onCreated: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({ registrar: '', steps: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('dns_reference_guides').insert({
      registrar: form.registrar,
      steps: form.steps,
      sort_order: nextSortOrder,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <input
        className="input"
        placeholder="Registrar or scenario (e.g. GoDaddy)"
        required
        value={form.registrar}
        onChange={(e) => setForm({ ...form, registrar: e.target.value })}
      />
      <textarea
        className="input"
        placeholder="Step-by-step notes"
        rows={6}
        required
        value={form.steps}
        onChange={(e) => setForm({ ...form, steps: e.target.value })}
      />
      {error && <p className="text-sm text-warn">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Saving...' : 'Save guide'}
      </button>
    </form>
  );
}
