'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';

const TARGET_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company (required)' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'industry', label: 'Industry' },
  { key: 'location', label: 'Location' },
  { key: 'notes', label: 'Notes' },
];

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

    const payload = rows
      .map((row) => {
        const contact: Record<string, string | null> = {};
        TARGET_FIELDS.forEach((field) => {
          const sourceCol = mapping[field.key];
          contact[field.key] = sourceCol ? row[sourceCol]?.trim() || null : null;
        });
        return contact;
      })
      .filter((c) => c.company);

    const { error } = await supabase.from('contacts').insert(payload);

    setImporting(false);
    setResult(
      error
        ? `Import failed: ${error.message}`
        : `Imported ${payload.length} ${payload.length === 1 ? 'contact' : 'contacts'}.`
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
        <h1 className="text-xl font-medium">Import contacts</h1>
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
