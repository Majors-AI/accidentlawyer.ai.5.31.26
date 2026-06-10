// Owner Portal § 2 — Firm-wide accounting reporting (scaffold). Placeholder
// aggregates; the real figures come from settlements / disbursements /
// trust_ledger (and Reporting.tsx). Owner-only via the guarded route.
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card kpi" style={{ marginBottom: 0 }}>
      <div className="kpi-num">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default function AccountingReporting() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Firm-wide accounting</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
          {/* TODO(real data): aggregate from settlements / disbursements /
              trust_ledger across all cases (see Reporting.tsx for the live query). */}
          Scaffold — placeholder aggregates. Real figures come from settlements / disbursements /
          trust_ledger across the firm.
        </p>
      </div>

      <div className="grid four">
        <StatCard label="Settlements (YTD)" value="—" />
        <StatCard label="Fees earned" value="—" />
        <StatCard label="Disbursements pending approval" value="—" />
        <StatCard label="Trust balances" value="—" />
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Disbursements pending approval</h3>
        <table>
          <thead>
            <tr><th>Case</th><th>Amount</th><th>Requested by</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={4} className="muted">No data — pending-approval queue populates from real disbursements (TODO).</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
