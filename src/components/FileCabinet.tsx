import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';

export type DocCategory =
  | 'fee_agreement'
  | 'accident_photos'
  | 'correspondence'
  | 'medical'
  | 'subrogation'
  | 'case_documents';

const ALL_LABELS: Record<DocCategory, string> = {
  fee_agreement:  'Fee agreement',
  accident_photos:'Accident photos',
  correspondence: 'Correspondence',
  medical:        'Medical bills & records',
  subrogation:    'Subrogation',
  case_documents: 'Case documents',
};

const DEFAULT_CATEGORIES: DocCategory[] = [
  'fee_agreement', 'accident_photos', 'correspondence', 'medical', 'subrogation', 'case_documents',
];

interface FileCabinetProps {
  caseId: string;
  firmId: string;
  categories?: DocCategory[];
  readOnlyCategories?: DocCategory[];
  categoryLabels?: Partial<Record<DocCategory, string>>;
}

export default function FileCabinet({
  caseId,
  firmId,
  categories,
  readOnlyCategories = [],
  categoryLabels = {},
}: FileCabinetProps) {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [busy, setBusy] = useState('');

  const activeCats = categories ?? DEFAULT_CATEGORIES;
  const readOnlySet = new Set(readOnlyCategories);

  async function load() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });
    setDocs(data ?? []);
  }
  useEffect(() => { load(); }, [caseId]);

  async function upload(category: DocCategory, file: File) {
    setBusy(category);
    const path = `${firmId}/${caseId}/${category}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('case-files').upload(path, file);
    if (!error) {
      await supabase.from('documents').insert({
        case_id: caseId, name: file.name, category,
        storage_path: path, uploaded_by: profile?.id,
      });
    }
    setBusy(''); load();
  }

  async function openDoc(d: any) {
    if (!d.storage_path) return;
    const { data } = await supabase.storage.from('case-files').createSignedUrl(d.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="grid two">
      {activeCats.map(cat => {
        const label = categoryLabels[cat] ?? ALL_LABELS[cat];
        const items = docs.filter(d => d.category === cat);
        const readOnly = readOnlySet.has(cat);
        return (
          <div className="card" key={cat} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{label}</h3>
              <span className="tag soft tiny">{items.length}</span>
            </div>
            <div style={{ margin: '10px 0' }}>
              {items.length === 0 && <span className="muted small">Empty.</span>}
              {items.map(d => (
                <div key={d.id} className="clickable" onClick={() => openDoc(d)}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0',
                    borderBottom: '1px solid var(--paper-2)', fontSize: 13.5 }}>
                  <span>{d.name}</span>
                  <span className="muted tiny">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            {!readOnly && (
              <label className="btn ghost sm" style={{ display: 'inline-block', cursor: 'pointer' }}>
                {busy === cat ? 'Uploading…' : '+ Upload'}
                <input type="file" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && upload(cat, e.target.files[0])} />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
