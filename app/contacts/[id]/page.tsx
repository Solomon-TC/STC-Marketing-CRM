'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Contact, Deal, Task } from '@/lib/types';
import { contactDisplayName, DEAL_STAGES } from '@/lib/types';

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [contact, setContact] = useState<Contact | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');

  async function load() {
    const [{ data: c }, { data: d }, { data: t }] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('deals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('contact_id', id).order('due_date', { ascending: true }),
    ]);
    setContact(c);
    setDeals(d ?? []);
    setTasks(t ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setSaving(true);
    await supabase
      .from('contacts')
      .update({
        name: contact.name,
        company: contact.company,
        email: contact.email,
        phone: contact.phone,
        industry: contact.industry,
        location: contact.location,
        notes: contact.notes,
      })
      .eq('id', contact.id);
    setSaving(false);
  }

  async function handleDelete() {
    if (!contact) return;
    if (!confirm(`Delete ${contactDisplayName(contact)}? This also removes their deals and tasks.`)) return;
    await supabase.from('contacts').delete().eq('id', contact.id);
    router.push('/contacts');
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    await supabase.from('tasks').insert({
      contact_id: id,
      title: newTask,
      due_date: newTaskDue || null,
    });
    setNewTask('');
    setNewTaskDue('');
    load();
  }

  async function toggleTask(task: Task) {
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id);
    load();
  }

  if (!contact) {
    return <p className="text-sm text-ink/50">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/contacts" className="text-sm text-accent hover:underline">
            &larr; Back to contacts
          </Link>
          <h1 className="mt-1 font-serif text-2xl">{contactDisplayName(contact)}</h1>
        </div>
        <button onClick={handleDelete} className="text-sm text-warn hover:underline">
          Delete contact
        </button>
      </div>

      <form onSubmit={handleSave} className="card grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            className="input"
            value={contact.name ?? ''}
            onChange={(e) => setContact({ ...contact, name: e.target.value || null })}
          />
        </Field>
        <Field label="Company">
          <input
            className="input"
            value={contact.company ?? ''}
            onChange={(e) => setContact({ ...contact, company: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            value={contact.email ?? ''}
            onChange={(e) => setContact({ ...contact, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className="input"
            value={contact.phone ?? ''}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
          />
        </Field>
        <Field label="Industry">
          <input
            className="input"
            value={contact.industry ?? ''}
            onChange={(e) => setContact({ ...contact, industry: e.target.value })}
          />
        </Field>
        <Field label="Location">
          <input
            className="input"
            value={contact.location ?? ''}
            onChange={(e) => setContact({ ...contact, location: e.target.value })}
          />
        </Field>
        <Field label="Notes" full>
          <textarea
            className="input"
            rows={4}
            value={contact.notes ?? ''}
            onChange={(e) => setContact({ ...contact, notes: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Deals</h2>
          <Link href={`/deals?contactId=${contact.id}`} className="btn-secondary">
            Add to pipeline
          </Link>
        </div>
        {deals.length === 0 && <p className="text-sm text-ink/50">No deals yet for this contact.</p>}
        <div className="space-y-2">
          {deals.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span>{d.title}</span>
              <span className="text-ink/50">
                {DEAL_STAGES.find((s) => s.value === d.stage)?.label}
                {d.value ? ` · $${Number(d.value).toLocaleString()}` : ''}
              </span>
            </div>
          ))}
        </div>
        <Link href="/deals" className="mt-3 inline-block text-sm text-accent hover:underline">
          Manage deals in pipeline view
        </Link>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium">Tasks</h2>
        <div className="mb-3 space-y-2">
          {tasks.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} />
              <span className={t.done ? 'text-ink/40 line-through' : ''}>{t.title}</span>
              {t.due_date && <span className="text-ink/40">({t.due_date})</span>}
            </label>
          ))}
          {tasks.length === 0 && <p className="text-sm text-ink/50">No tasks yet.</p>}
        </div>
        <form onSubmit={addTask} className="flex flex-wrap gap-2">
          <input
            className="input max-w-xs"
            placeholder="New task"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
          />
          <input
            className="input max-w-[160px]"
            type="date"
            value={newTaskDue}
            onChange={(e) => setNewTaskDue(e.target.value)}
          />
          <button type="submit" className="btn-secondary">
            Add task
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-sm text-ink/60">{label}</label>
      {children}
    </div>
  );
}
