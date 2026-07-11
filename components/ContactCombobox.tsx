'use client';

import { useEffect, useRef, useState } from 'react';
import type { Contact } from '@/lib/types';
import { contactDisplayName } from '@/lib/types';

export default function ContactCombobox({
  contacts,
  value,
  onChange,
}: {
  contacts: Contact[];
  value: string;
  onChange: (contactId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = contacts.find((c) => c.id === value) ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? contacts.filter(
        (c) => contactDisplayName(c).toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
      )
    : contacts;

  function select(contactId: string) {
    onChange(contactId);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="input"
        placeholder="Search contacts..."
        value={open ? query : selected ? contactDisplayName(selected) : ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-black/10 bg-white shadow-md">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-ink/50 hover:bg-black/5"
            onClick={() => select('')}
          >
            No linked contact
          </button>
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-ink/40">No contacts match.</p>}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5"
              onClick={() => select(c.id)}
            >
              {contactDisplayName(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
