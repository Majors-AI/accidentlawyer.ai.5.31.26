import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import FileCabinet from '../../components/FileCabinet';

export default function Documents() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cl } = await supabase
        .from('clients').select('id, registered')
        .eq('profile_id', profile?.id).maybeSingle();
      if (!cl) { setLoading(false); return; }
      setRegistered(cl.registered ?? false);
      const { data } = await supabase
        .from('cases').select('id, firm_id')
        .eq('client_id', cl.id)
        .order('created_at', { ascending: false }).limit(1);
      if (data?.[0]) {
        setCaseId(data[0].id);
        setFirmId(data[0].firm_id);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>My documents</h1>
          <div className="sub">View and upload files related to your case.</div>
        </div>
      </div>

      {!caseId ? (
        <div className="card">
          <p className="muted small" style={{ margin: 0 }}>
            No case on file yet. Once you submit your intake an attorney will review it and
            your document folders will appear here.
          </p>
          <button className="btn oxblood" style={{ marginTop: 14 }} onClick={() => nav('/intake')}>
            Start intake
          </button>
        </div>
      ) : !registered ? (
        <div className="card">
          <span className="tag gold">Setup required</span>
          <p className="small" style={{ marginTop: 12 }}>
            Complete your engagement &amp; setup to unlock document uploads.
            Your fee agreement will appear here once the firm shares it.
          </p>
          <button className="btn oxblood sm" style={{ marginTop: 4 }} onClick={() => nav('/setup')}>
            Go to setup
          </button>
        </div>
      ) : (
        <FileCabinet
          caseId={caseId}
          firmId={firmId!}
          categories={['accident_photos', 'medical', 'fee_agreement']}
          readOnlyCategories={['fee_agreement']}
          categoryLabels={{ medical: 'Medical records' }}
        />
      )}
    </>
  );
}
