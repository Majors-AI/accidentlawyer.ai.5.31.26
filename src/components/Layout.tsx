import { NavLink } from 'react-router-dom';
import { useAuth, isFirm } from '../App';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const superAdmin = profile?.is_platform_admin;
  const firm = isFirm(profile?.role) && !superAdmin;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Accident<br />Lawyer<span style={{color:'var(--oxblood)'}}>.ai</span>
          <small>{superAdmin ? 'Platform Admin' : 'Case Intelligence'}</small>
        </div>

        {superAdmin ? (
          <nav className="nav">
            <div className="group">Platform</div>
            <NavLink to="/firms" className={({isActive})=>isActive?'active':''}>Firms & metrics</NavLink>
          </nav>
        ) : firm ? (
          <nav className="nav">
            <div className="group">Caseload</div>
            <NavLink to="/cases" className={({isActive})=>isActive?'active':''}>All cases</NavLink>
            <NavLink to="/approvals" className={({isActive})=>isActive?'active':''}>Approval inbox</NavLink>
            <NavLink to="/legacy" className={({isActive})=>isActive?'active':''}>Legacy import</NavLink>
            <div className="group">Firm</div>
            <NavLink to="/account" className={({isActive})=>isActive?'active':''}>Account & billing</NavLink>
            <div className="group">Coming online</div>
            <a title="Scaffolded — built next">Calendar & meetings</a>
            <a title="Scaffolded — built next">Dropbox backups</a>
            <a title="Scaffolded — built next">Trust accounting</a>
            <a title="Scaffolded — built next">Reporting</a>
          </nav>
        ) : (
          <nav className="nav">
            <div className="group">My case</div>
            <NavLink to="/" end className={({isActive})=>isActive?'active':''}>Dashboard</NavLink>
            <NavLink to="/journal" className={({isActive})=>isActive?'active':''}>Injury journal</NavLink>
            <NavLink to="/wage-loss" className={({isActive})=>isActive?'active':''}>Wage loss</NavLink>
            <NavLink to="/treatment" className={({isActive})=>isActive?'active':''}>Treatment</NavLink>
            <NavLink to="/documents" className={({isActive})=>isActive?'active':''}>My documents</NavLink>
            <NavLink to="/messages" className={({isActive})=>isActive?'active':''}>Messages</NavLink>
            <NavLink to="/setup" className={({isActive})=>isActive?'active':''}>Engagement & setup</NavLink>
            <NavLink to="/intake" className={({isActive})=>isActive?'active':''}>Edit intake</NavLink>
            <div className="group">Account</div>
            <NavLink to="/profile" className={({isActive})=>isActive?'active':''}>My profile</NavLink>
          </nav>
        )}

        <div className="who">
          <b>{profile?.full_name}</b><br />
          <span className="muted tiny">{superAdmin ? 'platform admin' : profile?.role}</span>
          <button className="btn ghost sm" style={{color:'#e9e3d4',borderColor:'rgba(255,255,255,.2)'}} onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
