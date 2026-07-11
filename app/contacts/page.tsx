'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Contact, ContactNote } from '@/lib/types';
import { contactDisplayName, formatNoteTimestamp } from '@/lib/types';

const SCROLL_KEY = 'contacts-scroll-position';

export default function ContactsPage() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notesByContact, setNotesByContact] = useState<Record<string, ContactNote[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const skipUrlWrite = useRef(true);
  const scrollRestored = useRef(false);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: n }] = await Promise.all([
      supabase.from('contacts').select('*'),
      supabase.from('contact_notes').select('*').order('created_at', { ascending: false }),
    ]);
    setContacts(c ?? []);
    const grouped: Record<string, ContactNote[]> = {};
    (n ?? []).forEach((note) => {
      (grouped[note.contact_id] ??= []).push(note);
    });
    setNotesByContact(grouped);
    setLoading(false);
  }

  // Restore filters from the URL (e.g. returning from a contact via back
  // navigation), then load. Writing filters back to the URL is handled by a
  // separate effect below, skipped on this first pass.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('search');
    const ind = params.get('industry');
    const loc = params.get('location');
    if (s) setSearch(s);
    if (ind) setIndustryFilter(ind);
    if (loc) setLocationFilter(loc);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipUrlWrite.current) {
      skipUrlWrite.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (industryFilter !== 'all') params.set('industry', industryFilter);
    if (locationFilter !== 'all') params.set('location', locationFilter);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/contacts?${qs}` : '/contacts');
  }, [search, industryFilter, locationFilter]);

  // Restore scroll position once the list has actually rendered, if we're
  // returning from a contact's detail page.
  useEffect(() => {
    if (!loading && !scrollRestored.current) {
      scrollRestored.current = true;
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        requestAnimationFrame(() => window.scrollTo(0, Number(saved)));
        sessionStorage.removeItem(SCROLL_KEY);
      }
    }
  }, [loading]);

  const industries = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.industry).filter(Boolean))) as string[],
    [contacts]
  );
  const locations = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.location).filter(Boolean))) as string[],
    [contacts]
  );

  // Default view is alphabetical by industry (uncategorized contacts last);
  // this still applies however the list is filtered.
  const filtered = contacts
    .filter((c) => {
      const matchesSearch =
        search.trim() === '' ||
        [c.company, c.email].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
      const matchesIndustry = industryFilter === 'all' || c.industry === industryFilter;
      const matchesLocation = locationFilter === 'all' || c.location === locationFilter;
      return matchesSearch && matchesIndustry && matchesLocation;
    })
    .sort((a, b) => {
      const ai = a.industry?.trim() || '';
      const bi = b.industry?.trim() || '';
      if (!ai && !bi) return 0;
      if (!ai) return 1;
      if (!bi) return -1;
      return ai.localeCompare(bi);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Contacts</h1>
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
          placeholder="Search company, email"
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
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Industry</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Notes</th>
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
                  <Link
                    href={`/contacts/${c.id}`}
                    onClick={() => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))}
                    className="text-accent hover:underline"
                  >
                    {contactDisplayName(c)}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink/70">{c.industry ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">{c.location ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">{c.email ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">{c.phone ?? '—'}</td>
                <td className="px-4 py-2 text-ink/70">
                  <NotesPreviewCell notes={notesByContact[c.id] ?? []} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Shows the latest note truncated to one line; hovering reveals the full
// log (scrollable if it's long) via a portal so it's never clipped by the
// table's own scroll container.
function NotesPreviewCell({ notes }: { notes: ContactNote[] }) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setHovered(true);
  }

  if (notes.length === 0) {
    return <span className="text-ink/40">—</span>;
  }

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
      className="max-w-xs truncate"
    >
      {notes[0].body}
      {hovered &&
        pos &&
        createPortal(
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-50 max-h-56 w-72 overflow-y-auto rounded-md border border-black/10 bg-white p-2 text-xs shadow-lg"
          >
            {notes.map((n) => (
              <div key={n.id} className="mb-2 border-b border-black/5 pb-2 last:mb-0 last:border-0 last:pb-0">
                <p className="text-ink/40">{formatNoteTimestamp(n.created_at)}</p>
                <p className="whitespace-pre-wrap text-ink/80">{n.body}</p>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

function NewContactForm({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    company: '',
    email: '',
    phone: '',
    industry: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('contacts').insert({
      company: form.company,
      email: form.email || null,
      phone: form.phone || null,
      industry: form.industry || null,
      location: form.location || null,
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
        placeholder="Company"
        required
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
      {error && <p className="text-sm text-warn sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save contact'}
        </button>
      </div>
    </form>
  );
}
