import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { DEFAULT_BODIES } from '../../lib/letters';

const TEMPLATE_TYPES = ['lor_adverse', 'lor_own_carrier', 'lor_provider', 'declination'] as const;
type TemplateType = typeof TEMPLATE_TYPES[number];

const TYPE_LABELS: Record<TemplateType, string> = {
  lor_adverse: 'LOR — Adverse carrier',
  lor_own_carrier: "LOR — Client's own carrier",
  lor_provider: 'LOR — Medical provider',
  declination: 'Declination letter',
};

const MERGE_TOKENS = [
  'client_name', 'date_of_loss', 'claim', 'jurisdiction',
  'recipient', 'carrier', 'provider_name', 'firm_name', 'attorney_name',
];

export default function Templates() {
  const { profile } = useAuth();
  const firmId = profile?.firm_id;

  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ type: 'lor_adverse' as TemplateType, name: '', body: '' });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    if (!firmId) return;
    const { data } = await supabase.from('templates').select('*').eq('firm_id', firmId).order('type');
    setTemplates(data ?? []);
  }

  useEffect(() => { load(); }, [firmId]);

  async function save() {
    if (!firmId) return;
    setSaving(true);
    if (editing) {
      await supabase.from('templates')
        .update({ type: editing.type, name: editing.name, body: editing.body })
        .eq('id', editing.id);
      setEditing(null);
    } else {
      await supabase.from('templates').insert({
        firm_id: firmId, type: form.type, name: form.name, body: form.body,
      });
      setForm({ type: 'lor_adverse', name: '', body: '' });
      setAdding(false);
    }
    setSaving(false);
    load();
  }

  async function del(id: string) {
    await supabase.from('templates').delete().eq('id', id);
    load();
  }

  async function loadDefaults() {
    if (!firmId) return;
    setSeeding(true);
    setMsg('');
    const existing = new Set(templates.map(t => t.type));
    const missing = TEMPLATE_TYPES.filter(t => !existing.has(t));
    if (missing.length === 0) {
      setMsg('All default templates are already loaded for this firm.');
      setSeeding(false);
      return;
    }
    await supabase.from('templates').insert(
      missing.map(t => ({
        firm_id: firmId,
        type: t,
        name: TYPE_LABELS[t],
        body: DEFAULT_BODIES[t],
      }))
    );
    setMsg(`Seeded ${missing.length} default template${missing.length > 1 ? 's' : ''}: ${missing.map(t => t.replace(/_/g, ' ')).join(', ')}.`);
    setSeeding(false);
    load();
  }

  const formValid = editing
    ? !!(editing.name && editing.body)
    : !!(form.name && form.body);

  return (
    <>
      <div className="page-h">
        <h1>Letter templates</h1>
        <button className="btn sm" onClick={() => { setAdding(true); setEditing(null); setMsg(''); }}>
          + New template
        </button>
      </div>

      {msg && (
        <div className="flag warn" style={{ background: '#e3efe6', color: 'var(--good)' }}>{msg}</div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Merge tokens</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Use <code style={{ fontFamily: 'monospace' }}>{'{{token}}'}</code> in a template body — replaced with case data when a letter is drafted. Unknown tokens are left blank.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MERGE_TOKENS.map(t => (
            <code key={t} className="tag soft" style={{ fontFamily: 'monospace', fontSize: 12 }}>{`{{${t}}}`}</code>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn sm ghost" onClick={loadDefaults} disabled={seeding}>
            {seeding ? 'Loading defaults…' : 'Load default set'}
          </button>
          <span className="muted small">
            Seeds placeholder templates for types you haven't added yet — safe to click more than once.
          </span>
        </div>
      </div>

      {(adding || editing) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{editing ? 'Edit template' : 'New template'}</h3>
          <div className="row">
            <div>
              <label>Type</label>
              <select
                value={editing ? editing.type : form.type}
                onChange={e =>
                  editing
                    ? setEditing({ ...editing, type: e.target.value })
                    : setForm(f => ({ ...f, type: e.target.value as TemplateType }))
                }
              >
                {TEMPLATE_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Name</label>
              <input
                value={editing ? editing.name : form.name}
                onChange={e =>
                  editing
                    ? setEditing({ ...editing, name: e.target.value })
                    : setForm(f => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Standard LOR — adverse"
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Body</label>
            <textarea
              value={editing ? editing.body : form.body}
              onChange={e =>
                editing
                  ? setEditing({ ...editing, body: e.target.value })
                  : setForm(f => ({ ...f, body: e.target.value }))
              }
              rows={14}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}
              placeholder="Use {{token}} for merge fields. Clearly mark as DRAFT if not yet attorney-reviewed."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn sm" onClick={save} disabled={saving || !formValid}>
              {saving ? 'Saving…' : 'Save template'}
            </button>
            <button className="btn sm ghost" onClick={() => { setAdding(false); setEditing(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !adding && (
        <div className="card">
          <p className="muted">
            No templates yet. Click "Load default set" to seed reviewed-placeholder drafts, or create one manually.
          </p>
        </div>
      )}

      {templates.map(t => (
        <div className="card" key={t.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <span className="tag soft tiny" style={{ marginRight: 8, textTransform: 'none' }}>
                {t.type.replace(/_/g, ' ')}
              </span>
              <b>{t.name}</b>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                className="btn sm ghost"
                onClick={() => { setEditing({ ...t }); setAdding(false); setMsg(''); }}
              >
                Edit
              </button>
              <button
                className="btn sm ghost"
                style={{ color: 'var(--bad)' }}
                onClick={() => del(t.id)}
              >
                Delete
              </button>
            </div>
          </div>
          <pre style={{
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
            whiteSpace: 'pre-wrap', marginTop: 10, color: 'var(--ink-soft)',
            background: 'var(--paper)', borderRadius: 6, padding: '10px 12px',
            maxHeight: 160, overflow: 'auto',
          }}>
            {t.body}
          </pre>
        </div>
      ))}
    </>
  );
}
