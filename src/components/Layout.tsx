import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, isFirm } from '../App';
import { FIRM_NAV_GROUPS, FIRM_NAV_SOON } from '../layout/firmNav';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const superAdmin = profile?.is_platform_admin;
  const firm = isFirm(profile?.role) && !superAdmin;

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-header">
          <div className="brand">Accident<br />Lawyer<span style={{color:'var(--color-electric-blue)'}}>.ai</span>
            <small>{superAdmin ? 'Platform Admin' : 'Case Intelligence'}</small>
          </div>
        </div>

        <div className="side-nav">
          {superAdmin ? (
            <nav className="nav">
              <div className="group">Platform</div>
              <NavLink to="/firms" className={({isActive})=>isActive?'active':''}>Firms & metrics</NavLink>
            </nav>
          ) : firm ? (
            // Firm users now render in FirmShell (no sidebar); this branch is
            // kept for consistency and sources the same shared FIRM_NAV arrays.
            <nav className="nav">
              {FIRM_NAV_GROUPS.map(g => (
                <Fragment key={g.group}>
                  <div className="group">{g.group}</div>
                  {g.items.map(it => (
                    <NavLink key={it.to} to={it.to} end={it.end} className={({isActive})=>isActive?'active':''}>{it.label}</NavLink>
                  ))}
                </Fragment>
              ))}
              <div className="group">Coming online</div>
              {FIRM_NAV_SOON.map(label => (
                <a key={label} title="Scaffolded — built next">{label}</a>
              ))}
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
        </div>

        <div className="side-footer">
          <div className="who">
            <b>{profile?.full_name}</b>
            <span className="role">{superAdmin ? 'platform admin' : profile?.role}</span>
          </div>
          <button className="btn ghost sm" style={{color:'rgba(240,250,242,.8)',borderColor:'rgba(255,255,255,.18)'}} onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
