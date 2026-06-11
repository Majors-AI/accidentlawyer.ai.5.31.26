import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import {
  DOC_CATEGORIES,
  DOC_CATEGORY_LABELS,
  type DocCategory,
} from '../../components/FileCabinet';

// ── Firm-wide File Cabinet (journey stage 7) ────────────────────────────────
// A document surface ACROSS the firm's cases — the per-case <FileCabinet /> only
// ever sees one case. Browse / search / filter by category, download, and upload
// (upload requires a case context, so it scopes to a case the user picks).
//
// READ-SCOPING GUARDRAIL (defense in depth): a firm-wide list widens the access
// surface, so every query is EXPLICITLY scoped to the current user's firm_id via
// an inner join on cases, on top of the documents RLS policy
// ("documents firm access": case_id ∈ cases where firm_id = my_firm_id()).
// `documents` has no firm_id column of its own — firm membership lives on the
// parent case — so the scope is expressed as cases.firm_id = profile.firm_id.
// If profile.firm_id is missing we render nothing and never query: the view can
// never return another firm's — or an unrelated case's — documents.

type FirmDoc = {
  id: string;
  name: string;
  category: DocCategory | null;
  storage_path: string | null;
  created_at: string;
  case_id: string;
  cases: { id: string; firm_id: string; claim: string | null;
           clients: { full_name: string | null } | null } | null;
};

type FirmCase = { id: string; claim: string | null;
                  clients: { full_name: string | null } | null };

const ALL = 'all' as const;

export default function FirmFileCabinet() {
  const { profile } = useAuth();
  const firmId = profile?.firm_id ?? null;

  const [docs, setDocs] = useState<FirmDoc[]>([]);
  const [cases, setCases] = useState<FirmCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<DocCategory | typeof ALL>(ALL);

  // Upload panel (scoped to a chosen case — the firm-wide view has no single
  // case context, so we ask for one rather than inventing a new upload path).
  const [upCase, setUpCase] = useState('');
  const [upCat, setUpCat] = useState<DocCategory>('case_documents');
  const [busy, setBusy] = useState(false);

  async function load() {
    // Hard guard: no firm → no query, no leak.
    if (!firmId) { setDocs([]); setCases([]); setLoading(false); return; }
    setLoading(true);
    // Explicit firm scope: documents joined to their parent case, filtered to
    // THIS firm. `cases!inner` drops any document whose case is outside the
    // filter; .eq('cases.firm_id', firmId) is the firm-scoping constraint.
    const { data: docData } = await supabase
      .from('documents')
      .select('id, name, category, storage_path, created_at, case_id, ' +
              'cases!inner(id, firm_id, claim, clients(full_name))')
      .eq('cases.firm_id', firmId)
      .order('created_at', { ascending: false });
    // Cases for the upload picker — also explicitly firm-scoped.
    const { data: caseData } = await supabase
      .from('cases')
      .select('id, claim, clients(full_name)')
      .eq('firm_id', firmId)
      .order('updated_at', { ascending: false });
    // PostgREST infers embedded relations as arrays; at runtime these to-one
    // joins are single objects — cast through unknown to our shapes.
    setDocs((docData as unknown as FirmDoc[]) ?? []);
    setCases((caseData as unknown as FirmCase[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const caseLabel = (c: FirmDoc['cases'] | FirmCase | null) => {
    if (!c) return 'Unknown case';
    const who = c.clients?.full_name ?? 'Unnamed client';
    const claim = (c.claim ?? '').replace(/_/g, ' ');
    return claim ? `${who} · ${claim}` : who;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter(d => {
      if (cat !== ALL && d.category !== cat) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q)
        || caseLabel(d.cases).toLowerCase().includes(q);
    });
  }, [docs, query, cat]);

  async function openDoc(d: FirmDoc) {
    if (!d.storage_path) return;
    const { data } = await supabase.storage.from('case-files')
      .createSignedUrl(d.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function upload(file: File) {
    if (!firmId || !upCase) return;
    setBusy(true);
    // Path convention shared with per-case FileCabinet + storage RLS:
    // {firm_id}/{case_id}/{category}/{filename}. firm_id leads, matching the
    // "case-files firm" storage policy (foldername[1] = my_firm_id()).
    const path = `${firmId}/${upCase}/${upCat}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('case-files').upload(path, file);
    if (!error) {
      await supabase.from('documents').insert({
        case_id: upCase, name: file.name, category: upCat,
        storage_path: path, uploaded_by: profile?.id,
      });
    }
    setBusy(false);
    load();
  }

  if (!firmId) {
    return (
      <div className="page-h"><div>
        <h1>File Cabinet</h1>
        <div className="sub">No firm is associated with your account.</div>
      </div></div>
    );
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>File Cabinet</h1>
          <div className="sub">
            {loading ? 'Loading…'
              : `${docs.length} document${docs.length === 1 ? '' : 's'} across the firm`}
          </div>
        </div>
      </div>

      {/* Upload — scoped to a selected case */}
      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Upload a document</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 280px' }}>
            <label>Case</label>
            <select value={upCase} onChange={e => setUpCase(e.target.value)}>
              <option value="">Select a case…</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{caseLabel(c)}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label>Category</label>
            <select value={upCat} onChange={e => setUpCat(e.target.value as DocCategory)}>
              {DOC_CATEGORIES.map(c => (
                <option key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <label className="btn sm" style={{ cursor: upCase ? 'pointer' : 'not-allowed', opacity: upCase ? 1 : 0.5 }}>
            {busy ? 'Uploading…' : '+ Upload'}
            <input type="file" style={{ display: 'none' }} disabled={!upCase || busy}
              onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
        {!upCase && <div className="muted tiny" style={{ marginTop: 8 }}>Pick a case to enable upload.</div>}
      </div>

      {/* Search + category filter */}
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 280px' }}>
            <label>Search</label>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Filename or case / client…" />
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label>Category</label>
            <select value={cat} onChange={e => setCat(e.target.value as DocCategory | typeof ALL)}>
              <option value={ALL}>All categories</option>
              {DOC_CATEGORIES.map(c => (
                <option key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Document list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr>
            <th>Document</th><th>Category</th><th>Case</th><th>Added</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="muted">Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={4} className="muted">
                {docs.length === 0 ? 'No documents in the cabinet yet.' : 'No documents match.'}
              </td></tr>
            )}
            {filtered.map(d => (
              <tr key={d.id} className="clickable" onClick={() => openDoc(d)}>
                <td><b>{d.name}</b></td>
                <td>
                  <span className="tag soft tiny">
                    {d.category ? (DOC_CATEGORY_LABELS[d.category] ?? d.category) : '—'}
                  </span>
                </td>
                <td className="small">{caseLabel(d.cases)}</td>
                <td className="small">{new Date(d.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
