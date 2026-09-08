'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WebsiteChecklistTemplate } from '@/lib/types';

// The editable master checklist (website_checklist_templates). Each new
// website client gets its own copy of whatever is active here at the
// moment it's created (see the "New client" form on the Pipeline page) --
// editing or deactivating a template here never rewrites a client's
// existing checklist, since their copy has no live link back to this table.
export default function ChecklistTemplatesPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<WebsiteChecklistTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('website_checklist_templates')
      .select('*')
      .order('sort_order', { ascending: true });
    setTemplates(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleActive(template: WebsiteChecklistTemplate) {
    await supabase
      .from('website_checklist_templates')
      .update({ active: !template.active })
      .eq('id', template.id);
    load();
  }

  const byCategory = useMemo(() => {
    const groups: Record<string, WebsiteChecklistTemplate[]> = {};
    for (const t of templates) {
      (groups[t.category] ??= []).push(t);
    }
    return groups;
  }, [templates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Checklist Templates</h1>
          <p className="text-sm text-ink/60">
            The master checklist new clients get a copy of. Uncheck "Active" to retire an item without deleting
            it from clients who already have it.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'Add item'}
        </button>
      </div>

      {showForm && (
        <NewTemplateForm
          categories={Object.keys(byCategory)}
          nextSortOrder={templates.length > 0 ? Math.max(...templates.map((t) => t.sort_order)) + 1 : 1}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {templates.length === 0 && !showForm && <p className="text-sm text-ink/50">No checklist items yet.</p>}

      <div className="space-y-4">
        {Object.entries(byCategory).map(([category, items]) => (
          <div key={category} className="card">
            <h2 className="mb-3 text-sm font-medium">{category}</h2>
            <div className="space-y-2">
              {items.map((item) => (
                <TemplateRow key={item.id} template={item} onToggleActive={() => toggleActive(item)} onChanged={load} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateRow({
  template,
  onToggleActive,
  onChanged,
}: {
  template: WebsiteChecklistTemplate;
  onToggleActive: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ category: template.category, label: template.label });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from('website_checklist_templates')
      .update({ category: form.category, label: form.label })
      .eq('id', template.id);
    setSaving(false);
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${template.label}" from the template? Clients who already have it keep it.`)) return;
    await supabase.from('website_checklist_templates').delete().eq('id', template.id);
    onChanged();
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2 rounded-md border border-black/10 p-2">
        <input
          className="input flex-1 text-sm"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Category"
          required
        />
        <input
          className="input flex-1 text-sm"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Label"
          required
        />
        <button type="submit" disabled={saving} className="btn-primary text-xs">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-xs">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={template.active} onChange={onToggleActive} />
        <span className={template.active ? '' : 'text-ink/40 line-through'}>{template.label}</span>
      </label>
      <div className="flex gap-3 text-xs">
        <button onClick={() => setEditing(true)} className="text-ink/50 hover:text-ink hover:underline">
          Edit
        </button>
        <button onClick={handleDelete} className="text-warn hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

function NewTemplateForm({
  categories,
  nextSortOrder,
  onCreated,
}: {
  categories: string[];
  nextSortOrder: number;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({ category: categories[0] ?? '', label: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('website_checklist_templates').insert({
      category: form.category,
      label: form.label,
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
    <form onSubmit={handleSubmit} className="card grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-ink/50">Category</label>
        <input
          className="input"
          list="existing-categories"
          placeholder="e.g. Info gathering"
          required
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <datalist id="existing-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink/50">Label</label>
        <input
          className="input"
          placeholder="e.g. Photos received"
          required
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-warn sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save item'}
        </button>
      </div>
    </form>
  );
}
