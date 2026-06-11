// Send Queue view (SCAFFOLD).
//
// Subscribes to the in-memory queue store. "Generate from seed matter" runs the
// three document actions against the seed matter (2 LOR + 3 records + 3 bills).
// Release marks an item sent WITHOUT transmitting. Uses the seeded default
// templates this pass; the Template editor keeps its own in-memory copy, so a
// shared template store is a later pass.

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { QueueItem, QueueStatus } from './types';
import {
  subscribe, getItems, releaseItem, releaseBatch, updateItem, resetQueue,
} from './queue';
import { generateForDocActions, type FirmContext } from '../templates/generate';
import { DEFAULT_TEMPLATES } from '../templates/seedTemplates';
import { SEED_MATTER, SEED_FIRM_PROFILE } from '../seedMatter';
import { SEED_FIRM_CONFIG } from '../taskCatalog/seed';
import type { TemplateActionType } from '../templates/types';

const ACTION_LABEL: Record<TemplateActionType, string> = {
  send_lor: 'LOR',
  request_records: 'Records request',
  request_bills: 'Bills request',
};

const STATUS_STYLE: Record<QueueStatus, React.CSSProperties> = {
  draft: { background: 'rgba(9,17,53,.06)', color: 'var(--color-slate)' },
  incomplete: { background: 'rgba(176,38,38,.1)', color: '#b02626' },
  ready: { background: 'rgba(15,119,255,.12)', color: 'var(--color-electric-blue)' },
  released: { background: 'rgba(26,107,58,.12)', color: '#1a6b3a' },
  failed: { background: 'rgba(176,38,38,.14)', color: '#b02626' },
};

type Tab = 'ready' | 'incomplete' | 'released';
const TABS: { id: Tab; label: string; status: QueueStatus }[] = [
  { id: 'ready', label: 'Ready', status: 'ready' },
  { id: 'incomplete', label: 'Incomplete', status: 'incomplete' },
  { id: 'released', label: 'Released', status: 'released' },
];

const firmCtx: FirmContext = { profile: SEED_FIRM_PROFILE, templates: DEFAULT_TEMPLATES };
const docTasks = SEED_FIRM_CONFIG.departments.flatMap((d) => d.tasks);

export default function SendQueue() {
  const items = useSyncExternalStore(subscribe, getItems);
  const [tab, setTab] = useState<Tab>('ready');
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<QueueStatus, number> = { draft: 0, incomplete: 0, ready: 0, released: 0, failed: 0 };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  const current = TABS.find((t) => t.id === tab)!.status;
  const rows = items.filter((it) => it.status === current);

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function releaseSelected() {
    releaseBatch([...selected]);
    setSelected(new Set());
  }
  function fillField(item: QueueItem, key: string, value: string) {
    const body = item.renderedBody.split(`{{${key}}}`).join(value);
    updateItem(item.id, { renderedBody: body, missingFields: item.missingFields.filter((k) => k !== key) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Send queue</h3>
            <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
              Generated drafts wait here. Releasing marks an item sent — it does not transmit anything this pass.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm ghost" onClick={() => resetQueue()}>Clear</button>
            <button className="btn sm" onClick={() => generateForDocActions(docTasks, SEED_MATTER, firmCtx)}>
              Generate from seed matter
            </button>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="sq-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'sq-tab' + (tab === t.id ? ' active' : '')}
            onClick={() => { setTab(t.id); setOpenId(null); }}
          >
            {t.label} <span className="sq-tab-count">{counts[t.status]}</span>
          </button>
        ))}
        {tab === 'ready' && selected.size > 0 && (
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={releaseSelected}>
            Release selected ({selected.size})
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 0, padding: 0 }}>
        {rows.length === 0 && (
          <div className="tiny muted" style={{ padding: 18 }}>
            Nothing {current}. {counts.ready + counts.incomplete + counts.released === 0 && 'Click "Generate from seed matter" to populate.'}
          </div>
        )}
        {rows.map((it) => {
          const open = openId === it.id;
          return (
            <div key={it.id} className="sq-row-wrap">
              <div className="sq-row">
                {tab === 'ready' && (
                  <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(it.id)} onChange={() => toggleSel(it.id)} />
                )}
                <button className="sq-row-main" onClick={() => setOpenId(open ? null : it.id)}>
                  <span className="sq-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                  <span className="tag" style={{ background: 'rgba(9,17,53,.06)', color: 'var(--color-midnight-ink)' }}>
                    {ACTION_LABEL[it.actionType]}
                  </span>
                  <span className="sq-recipient">{it.recipient.name}</span>
                  <span className="tiny muted">{it.matterId === SEED_MATTER.id ? SEED_MATTER.number : it.matterId}</span>
                </button>
                <span className="tag" style={STATUS_STYLE[it.status]}>
                  {it.status}{it.autoReleased ? ' · auto' : ''}
                </span>
                {it.status === 'ready' && (
                  <button className="btn sm" onClick={() => releaseItem(it.id)}>Release</button>
                )}
              </div>

              {open && (
                <div className="sq-detail">
                  {it.missingFields.length > 0 && (
                    <div className="sq-missing">
                      <div className="tiny" style={{ fontWeight: 600, color: '#b02626' }}>
                        Missing required fields — fill to mark ready:
                      </div>
                      {it.missingFields.map((k) => (
                        <label key={k} className="sq-fill">
                          <span className="tiny muted">{k}</span>
                          <input
                            type="text"
                            placeholder={`value for ${k}`}
                            onBlur={(e) => e.target.value && fillField(it, k, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {it.subject && <div className="tiny muted" style={{ marginBottom: 6 }}>Subject: {it.subject}</div>}
                  <textarea
                    className="sq-preview"
                    value={it.renderedBody}
                    onChange={(e) => updateItem(it.id, { renderedBody: e.target.value })}
                    rows={Math.min(20, it.renderedBody.split('\n').length + 1)}
                  />
                  <div className="tiny muted">Edit before send — changes are kept on the queued item.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
