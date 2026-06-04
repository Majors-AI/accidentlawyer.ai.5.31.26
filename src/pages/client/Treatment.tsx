import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

const STATUS_TAG: Record<string, string> = {
  recommended: 'soft',
  scheduled: 'gold',
  ongoing: 'good',
  complete: 'ink',
};

export default function Treatment() {
  const { profile } = useAuth();
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cl } = await supabase
        .from('clients').select('id').eq('profile_id', profile?.id).maybeSingle();
      if (!cl) { setLoading(false); return; }
      const { data: kase } = await supabase
        .from('cases').select('id').eq('client_id', cl.id)
        .order('created_at', { ascending: false }).limit(1);
      if (!kase?.[0]) { setLoading(false); return; }
      const { data } = await supabase
        .from('treatments')
        .select('*, providers(name, specialty)')
        .eq('case_id', kase[0].id)
        .order('scheduled_at', { ascending: true });
      setTreatments(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="muted">Loading…</div>;

  const now = new Date();
  const upcoming = treatments.filter(t => t.scheduled_at && new Date(t.scheduled_at) >= now);
  const past = treatments.filter(t => !t.scheduled_at || new Date(t.scheduled_at) < now);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Treatment</h1>
          <div className="sub">Your providers and appointment schedule. Contact the firm to make any changes.</div>
        </div>
      </div>

      {treatments.length === 0 && (
        <div className="card">
          <span className="muted">
            No treatment records on file yet. Your case manager will add providers and
            appointments as your treatment plan is established.
          </span>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card">
          <h3>Upcoming appointments</h3>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Specialty</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map(t => (
                <tr key={t.id}>
                  <td><b>{t.providers?.name ?? '—'}</b></td>
                  <td className="small">{t.providers?.specialty ?? '—'}</td>
                  <td className="small">
                    {new Date(t.scheduled_at).toLocaleDateString('en-US',
                      { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>
                    <span className={`tag tiny ${STATUS_TAG[t.status] ?? 'soft'}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {past.length > 0 && (
        <div className="card">
          <h3>Past visits</h3>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Specialty</th>
                <th>Date</th>
                <th>Status</th>
                <th>Billed</th>
              </tr>
            </thead>
            <tbody>
              {past.map(t => (
                <tr key={t.id}>
                  <td><b>{t.providers?.name ?? '—'}</b></td>
                  <td className="small">{t.providers?.specialty ?? '—'}</td>
                  <td className="small">
                    {t.scheduled_at
                      ? new Date(t.scheduled_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td>
                    <span className={`tag tiny ${STATUS_TAG[t.status] ?? 'soft'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="small">
                    {t.total_billed ? `$${Number(t.total_billed).toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
