import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase, hasSupabase } from './lib/supabase';
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import Layout from './components/Layout';
import Intake from './pages/client/Intake';
import ClientDashboard from './pages/client/Dashboard';
import Setup from './pages/client/Setup';
import ClientMessages from './pages/client/Messages';
import Journal from './pages/client/Journal';
import WageLoss from './pages/client/WageLoss';
import Treatment from './pages/client/Treatment';
import Documents from './pages/client/Documents';
import Profile from './pages/client/Profile';
import CaseList from './pages/firm/CaseList';
import CaseDetail from './pages/firm/CaseDetail';
import ApprovalInbox from './pages/firm/ApprovalInbox';
import Account from './pages/firm/Account';
import Legacy from './pages/firm/Legacy';
import Reporting from './pages/firm/Reporting';
import Firms from './pages/admin/Firms';

type Profile = { id: string; full_name: string; email: string; role: string;
  firm_id: string | null; is_platform_admin: boolean };
type Ctx = { profile: Profile | null; loading: boolean; signOut: () => void };
const AuthCtx = createContext<Ctx>({ profile: null, loading: true, signOut: () => {} });
export const useAuth = () => useContext(AuthCtx);
export const isFirm = (r?: string) => r === 'attorney' || r === 'staff' || r === 'admin';

export default function App() {
  const loc = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data as Profile); setLoading(false);
  }
  useEffect(() => {
    if (!hasSupabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadProfile(data.session.user.id); else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const signOut = () => supabase.auth.signOut();

  if (loc.pathname === '/accept-invite') return <AcceptInvite />;
  if (loading) return <div className="auth"><div className="muted">Loading…</div></div>;
  if (!profile) return <Login />;

  const superAdmin = profile.is_platform_admin;
  const firm = isFirm(profile.role) && !superAdmin;

  return (
    <AuthCtx.Provider value={{ profile, loading, signOut }}>
      <Layout>
        <Routes>
          {superAdmin ? (
            <>
              <Route path="/" element={<Firms />} />
              <Route path="/firms" element={<Firms />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : firm ? (
            <>
              <Route path="/" element={<CaseList />} />
              <Route path="/cases" element={<CaseList />} />
              <Route path="/cases/:id" element={<CaseDetail />} />
              <Route path="/approvals" element={<ApprovalInbox />} />
              <Route path="/account" element={<Account />} />
              <Route path="/legacy" element={<Legacy />} />
              <Route path="/reporting" element={<Reporting />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<ClientDashboard />} />
              <Route path="/intake" element={<Intake />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/messages" element={<ClientMessages />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/wage-loss" element={<WageLoss />} />
              <Route path="/treatment" element={<Treatment />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </Layout>
    </AuthCtx.Provider>
  );
}
