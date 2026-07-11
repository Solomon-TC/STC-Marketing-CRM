'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';

const TARGET_FIELDS = [
  { key: 'company', label: 'Company (required)' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'industry', label: 'Industry' },
  { key: 'location', label: 'Location' },
  { key: 'notes', label: 'Notes' },
];

const CONTACT_FIELDS = TARGET_FIELDS.filter((f) => f.key !== 'notes');

export default function ImportPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        setRows(data);
        const cols = results.meta.fields ?? [];
        setHeaders(cols);

        // best-effort auto mapping by matching column names to target fields
        const auto: Record<string, string> = {};
        TARGET_FIELDS.forEach((field) => {
          const match = cols.find((c) => c.toLowerCase().trim() === field.key);
          if (match) auto[field.key] = match;
        });
        setMapping(auto);
      },
    });
  }

  async function handleImport() {
    if (!mapping.company) {
      setResult('Map a column to Company before importing, every contact needs one.');
      return;
    }
    setImporting(true);
    setResult(null);

    const parsed = rows
      .map((row) => {
        const contact: Record<string, string | null> = {};
        CONTACT_FIELDS.forEach((field) => {
          const sourceCol = mapping[field.key];
          contact[field.key] = sourceCol ? row[sourceCol]?.trim() || null : null;
        });
        const notesCol = mapping.notes;
        const noteBody = notesCol ? row[notesCol]?.trim() || null : null;
        return { contact, noteBody };
      })
      .filter((r) => r.contact.company);

    const { data: inserted, error } = await supabase
      .from('contacts')
      .insert(parsed.map((r) => r.contact))
      .select('id');

    if (!error && inserted) {
      const noteRows = inserted
        .map((c, i) => ({ contact_id: c.id, body: parsed[i].noteBody }))
        .filter((n): n is { contact_id: string; body: string } => !!n.body);
      if (noteRows.length > 0) {
        await supabase.from('contact_notes').insert(noteRows);
      }
    }

    setImporting(false);
    setResult(
      error
        ? `Import failed: ${error.message}`
        : `Imported ${parsed.length} ${parsed.length === 1 ? 'contact' : 'contacts'}.`
    );
    if (!error) {
      setRows([]);
      setHeaders([]);
      setMapping({});
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Import contacts</h1>
        <p className="text-sm text-ink/60">
          Upload a CSV export from your spreadsheet, map the columns, then import.
        </p>
      </div>

      <div className="card">
        <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
      </div>

      {result && (
        <p className="text-sm text-ink/70" role="status">
          {result}
        </p>
      )}

      {headers.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-sm font-medium">Map your columns</h2>
          <p className="text-xs text-ink/50">{rows.length} rows detected in the file.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGET_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm text-ink/60">{field.label}</label>
                <select
                  className="input"
                  value={mapping[field.key] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                >
                  <option value="">Don&apos;t import this field</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button onClick={handleImport} disabled={importing} className="btn-primary">
            {importing
              ? 'Importing...'
              : `Import ${rows.length} ${rows.length === 1 ? 'contact' : 'contacts'}`}
          </button>
        </div>
      )}
    </div>
  );
}
