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
import Calendar from './pages/firm/Calendar';
import Templates from './pages/firm/Templates';
import Reporting from './pages/firm/Reporting';
import Dashboard from './pages/firm/Dashboard';
import FirmSettings from './pages/firm/settings/FirmSettings';
import Firms from './pages/admin/Firms';
import FirmRegistration from './pages/admin/FirmRegistration';
import AppShell from './layout/AppShell';
import FirmShell from './layout/FirmShell';
import StagePage from './journey/StagePage';
import { JOURNEY_STAGES, canAccessStage, homeStage } from './journey/stages';
import type { JourneyStage } from './journey/stages';
import { FirmSettingsProvider } from './lib/firmSettings';
import Accounting from './pages/firm/settings/sections/Accounting';
import Legal from './pages/firm/settings/sections/Legal';

// Stages that map to a real surface already implemented in this repo. Stages
// absent from this map fall through to the StagePage "coming soon" placeholder.
// These surfaces are role-specific; viewing one as the "wrong" role shows
// degraded/empty data (cross-role correctness is a later pass). The firm
// department sections are wrapped in FirmSettingsProvider so they render
// standalone, the way FirmSettings.tsx wraps the whole hub.
const STAGE_ELEMENTS: Record<number, React.ReactNode> = {
  1: <FirmRegistration />,                          // Firm Registration (admin onboarding)
  3: <Intake />,                                   // Client Intake
  4: <ClientDashboard />,                           // Client Portal
  5: <FirmSettingsProvider><Accounting /></FirmSettingsProvider>, // Accounting Portal
  6: <FirmSettingsProvider><Legal /></FirmSettingsProvider>,      // Legal Department Portal
  9: <FirmSettings />,                              // Law Firm Settings (self-contained)
  10: <Firms />,                                     // AccidentLawyer.AI Admin (Firms console, self-contained)
};
// FirmSettings owns a nested <Routes> with relative paths, so its route needs a
// splat to let those descendant routes match.
const SPLAT_STAGES = new Set<number>([9]);

// One <Route> for a stage. Shared by the AppShell journey (clients + admins) and
// the firm shell so the path + element mapping lives in exactly one place.
// `relative` controls the path: relative to a parent layout route (AppShell,
// nested) or absolute (firm shell, flat). When `guard` is true, a profile that
// may not access the stage is redirected to its own role's home stage; the firm
// shell passes guard=false so every stage opens (real surface or coming-soon).
function stageRoute(
  stage: JourneyStage,
  profile: Profile | null,
  home: JourneyStage,
  relative: boolean,
  guard = true,
) {
  const raw = relative ? stage.path.replace('/journey/', '') : stage.path;
  const path = SPLAT_STAGES.has(stage.id) ? raw + '/*' : raw;
  const surface = STAGE_ELEMENTS[stage.id] ?? <StagePage title={stage.label} />;
  const element = !guard || canAccessStage(profile, stage)
    ? surface
    : <Navigate to={home.path} replace />;
  return <Route key={stage.id} path={path} element={element} />;
}

// AppShell journey subtree for clients + platform admins (firm users get the
// journey inside their normal Layout instead — see App below). AppShell is the
// layout element; stage routes map over JOURNEY_STAGES via the shared
// stageRoute helper, and the /journey index redirects to the role's home stage.
function JourneyRoutes() {
  const { profile } = useAuth();
  const home = homeStage(profile);
  return (
    <Routes>
      <Route path="/journey" element={<AppShell />}>
        <Route index element={<Navigate to={home.path} replace />} />
        {JOURNEY_STAGES.map((stage) => stageRoute(stage, profile, home, true))}
      </Route>
    </Routes>
  );
}

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

  // Invite acceptance stays public — invitees may not have a profile yet.
  if (loc.pathname === '/accept-invite') return <AcceptInvite />;
  if (loading) return <div className="auth"><div className="muted">Loading…</div></div>;
  if (!profile) return <Login />;

  const superAdmin = profile.is_platform_admin;
  const firm = isFirm(profile.role) && !superAdmin;
  const home = homeStage(profile);

  // The AppShell journey is for clients + platform admins only. Firm users get
  // the journey inside their own FirmShell (the firm routing below), so
  // /journey/* falls through. Journey requires an authenticated profile (gated
  // above) and carries its own AuthCtx.
  if (loc.pathname.startsWith('/journey') && !firm)
    return (
      <AuthCtx.Provider value={{ profile, loading, signOut }}>
        <JourneyRoutes />
      </AuthCtx.Provider>
    );

  // Post-login landing: clients land on the journey (their portal). Firm users
  // keep their Dashboard and platform admins keep the Firms console — both can
  // still open /journey manually.
  if (loc.pathname === '/' && profile.role === 'client') return <Navigate to="/journey" replace />;

  // Firm users render in the sidebar-less FirmShell: a top header + wide content
  // + the single full-width bottom bar that holds all firm nav (working pages +
  // journey stages). Every firm path is unchanged; the firm journey stages use
  // the same guarded stageRoute helper as the AppShell journey.
  if (firm)
    return (
      <AuthCtx.Provider value={{ profile, loading, signOut }}>
        <FirmShell>
          <div key={loc.pathname} className="page-enter">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cases" element={<CaseList />} />
              <Route path="/cases/:id" element={<CaseDetail />} />
              <Route path="/approvals" element={<ApprovalInbox />} />
              <Route path="/account" element={<Account />} />
              <Route path="/legacy" element={<Legacy />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/reporting" element={<Reporting />} />
              <Route path="/settings/*" element={<FirmSettings />} />
              {/* The firm shell exposes the FULL journey: every stage is
                  openable (real surface or coming-soon), no access redirect. */}
              {JOURNEY_STAGES.map((stage) => stageRoute(stage, profile, home, false, false))}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </FirmShell>
      </AuthCtx.Provider>
    );

  // Clients + platform admins keep the sidebar Layout exactly as before.
  return (
    <AuthCtx.Provider value={{ profile, loading, signOut }}>
      <Layout>
        <div key={loc.pathname} className="page-enter">
        <Routes>
          {superAdmin ? (
            <>
              <Route path="/" element={<Firms />} />
              <Route path="/firms" element={<Firms />} />
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
        </div>
      </Layout>
    </AuthCtx.Provider>
  );
}
