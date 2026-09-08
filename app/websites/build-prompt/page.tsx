'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// A single editable block of text -- whatever you paste into a new Claude
// Code session's master prompt to start building a client's site. Stored as
// a singleton row (website_build_prompt, id always 1), same pattern as
// website_pipeline_settings.
export default function BuildPromptPage() {
  const supabase = createClient();
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    supabase
      .from('website_build_prompt')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setContent(data.content ?? '');
          setSavedAt(data.updated_at);
        }
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    const { data, error } = await supabase
      .from('website_build_prompt')
      .update({ content })
      .eq('id', 1)
      .select()
      .single();
    setSaving(false);
    if (!error) {
      setDirty(false);
      if (data) setSavedAt(data.updated_at);
    }
  }

  function copy() {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Initial Build Prompt</h1>
          <p className="text-sm text-fog">
            The master prompt you paste into a new Claude Code session to start a build. Edit it any time.
          </p>
        </div>
        <button type="button" onClick={copy} className="btn-primary">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="card space-y-3">
        <textarea
          className="input font-mono text-sm"
          rows={24}
          value={content}
          placeholder="Paste your build prompt here..."
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          disabled={!loaded}
        />
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving || !dirty} className="btn-secondary">
            {saving ? 'Saving...' : 'Save'}
          </button>
          {!dirty && savedAt && (
            <span className="text-xs text-mist">Saved {new Date(savedAt).toLocaleString()}</span>
          )}
          {dirty && <span className="text-xs text-mist">Unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}
