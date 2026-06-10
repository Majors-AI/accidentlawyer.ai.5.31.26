// White Label (Settings § B). Logo + global color scheme + per-department
// scheme overrides, with a live preview driven by schemeToVars (the single
// theming mechanism). All edits flow through the firmSettings store (audited via
// logChange) and are gated to branding managers (owner / super-admin).
import { useAuth } from '../../../../App';
import {
  useFirmSettings, SCHEME_TOKENS, DEPT_IDS, DEPT_LABELS,
  type ColorScheme, type DeptId,
} from '../../../../lib/firmSettings';
import { derivePermissions } from '../../../../lib/permissions';
import { schemeToVars } from '../../../../lib/theme';

// ---- shared building blocks --------------------------------------------

// Per-token color inputs. Reused by the global editor and each dept override.
function ColorTokens({ scheme, readOnly, onToken }: {
  scheme: ColorScheme;
  readOnly: boolean;
  onToken: (key: keyof ColorScheme, value: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 4 }}>
      {SCHEME_TOKENS.map(({ key, label }) => (
        <div key={key}>
          <label style={{ margin: '0 0 4px' }}>{label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={scheme[key]}
              disabled={readOnly}
              onChange={e => onToken(key, e.target.value)}
              style={{ width: 46, height: 34, padding: 2, flex: '0 0 auto' }}
            />
            <span className="tiny muted">{scheme[key]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Sample UI rendered inside a wrapper that applies schemeToVars(scheme), so the
// palette is visible as it's edited. The SAME mechanism real application reuses.
function SchemePreview({ scheme, logoUrl, compact }: {
  scheme: ColorScheme; logoUrl: string | null; compact?: boolean;
}) {
  return (
    <div style={{
      ...schemeToVars(scheme),
      background: 'var(--background)',
      color: 'var(--text)',
      borderRadius: 12,
      padding: compact ? 12 : 16,
      border: '1px solid var(--color-frost-border)',
    }}>
      {/* nav strip */}
      <div style={{
        background: 'var(--primary)', color: '#fff', borderRadius: 8,
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
      }}>
        {logoUrl
          ? <img src={logoUrl} alt="logo" style={{ height: 18, maxWidth: 90, objectFit: 'contain' }} />
          : <b style={{ fontSize: 13 }}>Firm</b>}
        <span style={{ fontSize: 12, opacity: .9 }}>Dashboard</span>
        <span style={{ fontSize: 12, opacity: .9 }}>Cases</span>
      </div>
      {/* card */}
      <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid rgba(0,0,0,.06)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Sample card</div>
        <div style={{ fontSize: 13 }}>Body text in the theme’s text color.</div>
        <div style={{ fontSize: 12, color: 'var(--muted-text)', marginTop: 2 }}>Muted helper text.</div>
        {!compact && (
          <div style={{ marginTop: 10 }}>
            <button style={{
              background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 14px', fontSize: 13, cursor: 'default', width: 'auto',
            }}>Primary action</button>
            <span style={{
              display: 'inline-block', marginLeft: 8, background: 'var(--accent)', color: '#fff',
              borderRadius: 12, padding: '4px 11px', fontSize: 11,
            }}>Accent</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- per-department control (exported — step 4 embeds this same control) ----

export function DeptSchemeControl({ deptId, readOnly }: { deptId: DeptId; readOnly?: boolean }) {
  // Self-contained: derives its own permission if the parent doesn't pass one,
  // so it works both here and embedded inside a Department's own settings.
  const { profile } = useAuth();
  const ownReadOnly = !derivePermissions(profile).canManageBranding;
  const ro = readOnly ?? ownReadOnly;

  const { getWhiteLabel, getDeptScheme, setDeptScheme } = useFirmSettings();
  const override = getWhiteLabel().deptSchemes[deptId];   // null = inherit global
  const isOverride = override !== null;
  const effective = getDeptScheme(deptId);                // resolved (own or global)
  const logoUrl = getWhiteLabel().logoUrl;

  const toggle = () => {
    if (ro) return;
    if (isOverride) setDeptScheme(deptId, null);          // back to inherit
    else setDeptScheme(deptId, { ...effective });         // seed override from current effective
  };

  const setToken = (key: keyof ColorScheme, value: string) => {
    if (ro || !override) return;
    setDeptScheme(deptId, { ...override, [key]: value });
  };

  return (
    <div className="well" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <b style={{ fontSize: 14 }}>{DEPT_LABELS[deptId]}</b>{' '}
          <span className={isOverride ? 'tag gold' : 'tag soft'} style={{ marginLeft: 6 }}>
            {isOverride ? 'Override' : 'Inherits global'}
          </span>
        </div>
        <button className="btn ghost sm" disabled={ro} onClick={toggle}>
          {isOverride ? 'Reset to inherit' : 'Override'}
        </button>
      </div>

      {isOverride && override && (
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <ColorTokens scheme={override} readOnly={ro} onToken={setToken} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ margin: '0 0 4px' }}>Preview</label>
            <SchemePreview scheme={effective} logoUrl={logoUrl} compact />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- main section -------------------------------------------------------

export default function WhiteLabel() {
  const { profile } = useAuth();
  const readOnly = !derivePermissions(profile).canManageBranding;
  const { getWhiteLabel, setLogoUrl, setGlobalScheme } = useFirmSettings();
  const wl = getWhiteLabel();

  const onLogoFile = (file: File | undefined) => {
    if (!file || readOnly) return;
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);   // preview-only data URL — see TODO below
  };

  const setGlobalToken = (key: keyof ColorScheme, value: string) =>
    setGlobalScheme({ ...wl.globalScheme, [key]: value });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {readOnly && (
        <div className="card" style={{ marginBottom: 0 }}>
          <p className="tiny muted" style={{ margin: 0 }}>
            Read-only — branding is managed by firm owners / administrators.
          </p>
        </div>
      )}

      {/* Logo */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Logo</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 120, height: 60, borderRadius: 8, border: '1px solid var(--color-frost-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-mint-veil)', overflow: 'hidden',
          }}>
            {wl.logoUrl
              ? <img src={wl.logoUrl} alt="Firm logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              : <span className="tiny muted">No logo</span>}
          </div>
          <div style={{ flex: 1 }}>
            <input type="file" accept="image/*" disabled={readOnly}
              onChange={e => onLogoFile(e.target.files?.[0])} style={{ padding: 8 }} />
            {wl.logoUrl && !readOnly && (
              <button className="btn ghost sm" style={{ marginTop: 8, width: 'auto' }}
                onClick={() => setLogoUrl(null)}>Remove logo</button>
            )}
          </div>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          {/* TODO(real storage: Supabase Storage): upload the file to a bucket and
              store its URL; this in-memory data URL is preview-only and not saved. */}
          Preview only — the logo is held in memory (data URL). Real upload to
          Supabase Storage is TODO.
        </p>
      </div>

      {/* Global color scheme + live preview */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Global color scheme</h3>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <ColorTokens scheme={wl.globalScheme} readOnly={readOnly} onToken={setGlobalToken} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ margin: '0 0 4px' }}>Live preview</label>
            <SchemePreview scheme={wl.globalScheme} logoUrl={wl.logoUrl} />
          </div>
        </div>
      </div>

      {/* Per-department schemes */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Per-department schemes</h3>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          Each department inherits the global scheme unless it overrides. This control
          is also embedded in each department’s own settings — one shared source.
        </p>
        {DEPT_IDS.map((d: DeptId) => (
          <DeptSchemeControl key={d} deptId={d} readOnly={readOnly} />
        ))}
      </div>
    </div>
  );
}
