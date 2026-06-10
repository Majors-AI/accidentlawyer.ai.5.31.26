// Owner Portal § 4 — Grant features to the platform super-admin. Each is an
// OFF-by-default toggle writing the audited setSuperAdminGrant. Owner-only via
// the guarded route.
import { useFirmSettings, SUPER_ADMIN_GRANTS } from '../../../../../lib/firmSettings';

export default function SuperAdminGrants() {
  const { getSuperAdminGrants, setSuperAdminGrant } = useFirmSettings();
  const grants = getSuperAdminGrants();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Grant features to super admin</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
          {/* TODO(permissions): when a grant is ON, derivePermissions / the
              platform-admin surface should expand the super-admin's capability
              for this firm accordingly. Today these only record the grant. */}
          All off by default. Turning one on would expand the platform super-admin’s capability for this
          firm (permissions wiring is a TODO — toggles record the grant today).
        </p>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        {SUPER_ADMIN_GRANTS.map(g => (
          <div key={g.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--color-frost-border)' }}>
            <div>
              <b style={{ fontSize: 14 }}>{g.label}</b>
              <div className="tiny muted">{g.detail}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', margin: 0, flex: '0 0 auto' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!grants[g.key]}
                onChange={e => setSuperAdminGrant(g.key, e.target.checked)} />
              <span className={grants[g.key] ? 'tag good' : 'tag soft'}>{grants[g.key] ? 'Granted' : 'Off'}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
