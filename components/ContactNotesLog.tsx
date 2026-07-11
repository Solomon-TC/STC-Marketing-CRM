'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ContactNote } from '@/lib/types';
import { formatNoteTimestamp } from '@/lib/types';

// A contact's notes as an append-only log: every save is a new, timestamped
// entry rather than an edit to one big free-text field. Existing entries can
// still be corrected or removed individually.
export default function ContactNotesLog({ contactId }: { contactId: string }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<ContactNote[] | null>(null);
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  async function load() {
    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setNotes(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAdding(true);
    await supabase.from('contact_notes').insert({ contact_id: contactId, body: newNote.trim() });
    setNewNote('');
    setAdding(false);
    load();
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    await supabase.from('contact_notes').update({ body: editText.trim() }).eq('id', id);
    setEditingId(null);
    load();
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note entry?')) return;
    await supabase.from('contact_notes').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-3">
      <form onSubmit={addNote} className="flex flex-col gap-2 sm:flex-row">
        <textarea
          className="input flex-1"
          rows={2}
          placeholder="Add a note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <button type="submit" disabled={adding} className="btn-secondary self-start">
          {adding ? 'Saving...' : 'Add note'}
        </button>
      </form>

      {notes === null && <p className="text-sm text-ink/50">Loading notes...</p>}
      {notes && notes.length === 0 && <p className="text-sm text-ink/50">No notes yet.</p>}

      {notes && notes.length > 0 && (
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="border-b border-black/5 pb-2 last:border-0">
              <div className="mb-1 flex items-center justify-between text-xs text-ink/40">
                <span>{formatNoteTimestamp(n.created_at)}</span>
                <span className="flex gap-2">
                  {editingId === n.id ? (
                    <>
                      <button type="button" onClick={() => saveEdit(n.id)} className="hover:underline">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="hover:underline">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditText(n.body);
                        }}
                        className="hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(n.id)}
                        className="text-warn hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </span>
              </div>
              {editingId === n.id ? (
                <textarea
                  className="input"
                  rows={2}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-ink/80">{n.body}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
