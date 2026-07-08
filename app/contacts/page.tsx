'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Contact } from '@/lib/types';

export default function ContactsPage() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    setContacts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const industries = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.industry).filter(Boolean))) as string[],
    [contacts]
  );
  const locations = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.location).filter(Boolean))) as string[],
    [contacts]
  );

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      search.trim() === '' ||
      [c.name, c.company, c.email].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchesIndustry = industryFilter === 'all' || c.industry === industryFilter;
    const matchesLocation = locationFilter === 'all' || c.location === locationFilter;
    return matchesSearch && matchesIndustry && matchesLocation;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Contacts</h1>
          <p className="text-sm text-ink/60">{contacts.length} total</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'Add contact'}
        </button>
      </div>

      {showForm && (
        <NewContactForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="card flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search name, company, email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left text-ink/50">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Industry</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-4 text-ink/50" colSpan={6}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-ink/50" colSpan={6}>
                  No contacts match those filters.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                <td className="px-4 py-2">
                  <Link href={`/contacts/${c.id}`} className="text-accent hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink/70">{c.company ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">{c.industry ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">{c.location ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">{c.email ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">{c.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewContactForm({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    industry: '',
    location: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('contacts').insert({
      ...form,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      industry: form.industry || null,
      location: form.location || null,
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
        placeholder="Name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className="input"
        placeholder="Company"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
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
      <input
        className="input"
        placeholder="Industry"
        value={form.industry}
        onChange={(e) => setForm({ ...form, industry: e.target.value })}
      />
      <input
        className="input"
        placeholder="Location"
        value={form.location}
        onChange={(e) => setForm({ ...form, location: e.target.value })}
      />
      <textarea
        className="input sm:col-span-2"
        placeholder="Notes"
        rows={3}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
      {error && <p className="text-sm text-warn sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save contact'}
        </button>
      </div>
    </form>
  );
}
