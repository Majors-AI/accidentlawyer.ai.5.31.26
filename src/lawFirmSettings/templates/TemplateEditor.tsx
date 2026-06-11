// Action Templates editor (SCAFFOLD).
//
// In-memory: edits a local copy of the seeded default templates. "Reset to firm
// default" restores the seeded original. Live preview renders against the seed
// matter (first carrier for LOR, first provider for records/bills).
// TODO(real: Supabase) — load/save per-firm templates; share state with the
// send queue so generation uses customized copies.

import { useMemo, useRef, useState } from 'react';
import type { DocTemplate, TemplateActionType } from './types';
import { MERGE_FIELDS } from './registry';
import { DEFAULT_TEMPLATES } from './seedTemplates';
import { buildMergeContext, carrierContext, providerContext, renderTemplate } from './mergeContext';
import { SEED_MATTER, SEED_FIRM_PROFILE } from '../seedMatter';

const ACTION_LABEL: Record<TemplateActionType, string> = {
  send_lor: 'Letter of Representation',
  request_records: 'Records request',
  request_bills: 'Bills request',
};

// Preview context: base + a representative recipient for the action type.
function previewContext(action: TemplateActionType): Record<string, string> {
  const base = buildMergeContext(SEED_MATTER, SEED_FIRM_PROFILE);
  if (action === 'send_lor') return { ...base, ...carrierContext(SEED_MATTER.carriers[0]) };
  return { ...base, ...providerContext(SEED_MATTER.providers[0]) };
}

export default function TemplateEditor() {
  const [templates, setTemplates] = useState<DocTemplate[]>(() => structuredClone(DEFAULT_TEMPLATES));
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_TEMPLATES[0].id);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const tpl = templates.find((t) => t.id === selectedId) ?? templates[0];
  const preview = useMemo(() => renderTemplate(tpl, previewContext(tpl.actionType)), [tpl]);

  function patch(p: Partial<DocTemplate>) {
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, ...p, isFirmDefault: false } : t)));
  }
  function insertField(key: string) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) { patch({ body: tpl.body + token }); return; }
    const start = el.selectionStart ?? tpl.body.length;
    const end = el.selectionEnd ?? start;
    const next = tpl.body.slice(0, start) + token + tpl.body.slice(end);
    patch({ body: next });
    // restore caret after the inserted token
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }
  function resetToDefault() {
    const original = DEFAULT_TEMPLATES.find((t) => t.id === tpl.id);
    if (original) setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? structuredClone(original) : t)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Action templates</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 12 }}>
          Per-firm document templates with merge fields. Generation uses the firm's customized template, falling back to the seeded default.
        </p>
        <div className="te-tabs">
          {templates.map((t) => (
            <button
              key={t.id}
              className={'te-tab' + (t.id === tpl.id ? ' active' : '')}
              onClick={() => setSelectedId(t.id)}
            >
              {ACTION_LABEL[t.actionType]}
              {!t.isFirmDefault && <span className="te-edited" title="Customized">•</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="te-grid">
        {/* editor */}
        <div className="card" style={{ marginBottom: 0 }}>
          <label>Template name</label>
          <input type="text" value={tpl.name} onChange={(e) => patch({ name: e.target.value })} />

          <label style={{ marginTop: 12 }}>Subject</label>
          <input type="text" value={tpl.subject ?? ''} onChange={(e) => patch({ subject: e.target.value })} />

          <label style={{ marginTop: 12 }}>Insert merge field</label>
          <div className="te-fields">
            {MERGE_FIELDS[tpl.actionType].map((f) => (
              <button key={f.key} className="te-field" title={f.required ? `${f.key} (required)` : f.key} onClick={() => insertField(f.key)}>
                {f.label}{f.required && <span className="te-req">*</span>}
              </button>
            ))}
          </div>

          <label style={{ marginTop: 12 }}>Body</label>
          <textarea
            ref={bodyRef}
            value={tpl.body}
            onChange={(e) => patch({ body: e.target.value })}
            rows={18}
            style={{ fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.5 }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn sm ghost" onClick={resetToDefault} disabled={tpl.isFirmDefault} title={tpl.isFirmDefault ? 'Already the firm default' : 'Restore the seeded default'}>
              Reset to firm default
            </button>
          </div>
        </div>

        {/* live preview */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Live preview</h3>
            {preview.missingFields.length > 0 && (
              <span className="tag" style={{ background: 'rgba(176,38,38,.1)', color: '#b02626' }}>
                {preview.missingFields.length} missing
              </span>
            )}
          </div>
          {preview.subject && <div className="tiny muted" style={{ marginTop: 8 }}>Subject: {preview.subject}</div>}
          <pre className="te-preview">{preview.body}</pre>
          {preview.missingFields.length > 0 && (
            <div className="tiny muted">Missing required: {preview.missingFields.join(', ')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
