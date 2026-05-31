// ============================================================================
// Seed script — creates test logins + sample data.
// Run ONCE after applying schema.sql:
//   1) npm i @supabase/supabase-js
//   2) SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed.mjs
// Find both values in Supabase → Project Settings → API.
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const PW = 'TestPass123!'; // password for every seeded login

const users = [
  { email: 'super@accidentlawyer.ai',    full_name: 'Platform Admin', role: 'admin', platform: true },
  { email: 'attorney@accidentlawyer.ai', full_name: 'Dana Reyes',   role: 'attorney' },
  { email: 'staff@accidentlawyer.ai',    full_name: 'Sam Ortega',   role: 'staff' },
  { email: 'client1@example.com',        full_name: 'Marcus Webb',  role: 'client' },
  { email: 'client2@example.com',        full_name: 'Lena Park',    role: 'client' },
];

async function makeUser(u) {
  const { data, error } = await db.auth.admin.createUser({
    email: u.email, password: PW, email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  });
  if (error && !error.message.includes('already')) throw error;
  // fetch id (trigger creates the profile row automatically)
  const { data: list } = await db.auth.admin.listUsers();
  return list.users.find(x => x.email === u.email).id;
}

async function main() {
  console.log('Seeding reference data…');
  await db.from('jurisdictions').upsert([
    { code: 'AZ', name: 'Arizona',    comparative_scheme: 'pure_comparative' },
    { code: 'WA', name: 'Washington', comparative_scheme: 'pure_comparative' },
  ]);
  // NOTE: verify these citations/lengths against current law before relying on them.
  await db.from('sol_rules').upsert([
    { jurisdiction:'AZ', claim:'mva',            years:2, citation:'A.R.S. § 12-542', notice_days:null },
    { jurisdiction:'AZ', claim:'negligence',     years:2, citation:'A.R.S. § 12-542', notice_days:null },
    { jurisdiction:'AZ', claim:'slip_and_fall',  years:2, citation:'A.R.S. § 12-542', notice_days:null },
    { jurisdiction:'AZ', claim:'dog_bite',       years:1, citation:'A.R.S. § 11-1025 / 12-541', notice_days:null },
    { jurisdiction:'AZ', claim:'wrongful_death', years:2, citation:'A.R.S. § 12-542', notice_days:null },
    { jurisdiction:'AZ', claim:'other',          years:2, citation:'A.R.S. § 12-542', notice_days:180, notes:'Govt defendant: 180-day notice of claim (A.R.S. § 12-821.01)' },
    { jurisdiction:'WA', claim:'mva',            years:3, citation:'RCW 4.16.080', notice_days:null },
    { jurisdiction:'WA', claim:'negligence',     years:3, citation:'RCW 4.16.080', notice_days:null },
    { jurisdiction:'WA', claim:'wrongful_death', years:3, citation:'RCW 4.16.080', notice_days:null },
  ], { onConflict: 'jurisdiction,claim', ignoreDuplicates: true }).then(()=>{},()=>{});

  const { data: firmRows } = await db.from('firms')
    .upsert({ name: 'Accident Lawyer AI (Demo Firm)', default_jurisdiction: 'AZ',
              data_security_agreed: true, clients_informed_agreed: true,
              allow_platform_metrics: true, marketing_source: 'Google Ads' }).select();
  const firm_id = firmRows?.[0]?.id ?? (await db.from('firms').select('id').limit(1)).data[0].id;

  await db.from('providers').upsert([
    { name: 'Desert Spine & Injury', specialty:'Chiropractic', city:'Tempe', state:'AZ', phone:'480-555-0101' },
    { name: 'Valley Ortho Group',    specialty:'Orthopedics',  city:'Phoenix', state:'AZ', phone:'602-555-0144' },
  ]);

  await db.from('templates').upsert([
    { firm_id, type:'lor',           name:'Standard LOR',           body:'Re: {{client_name}} — DOL {{date_of_loss}}\n\nThis confirms our representation of {{client_name}} for injuries sustained on {{date_of_loss}}…' },
    { firm_id, type:'fee_agreement', name:'Contingency Fee (AZ)',   body:'Attorney fee: {{fee_pct}} pre-litigation; 40% upon filing suit…' },
    { firm_id, type:'demand',        name:'Demand Skeleton',        body:'DEMAND FOR SETTLEMENT — {{client_name}}\nDate of loss: {{date_of_loss}}\nLiability: …\nDamages: …\nDemand: {{amount_sought}}' },
  ]);

  console.log('Creating test users…');
  const ids = {};
  for (const u of users) { ids[u.email] = await makeUser(u); console.log('  •', u.email); }
  // attach firm to staff/attorney profiles
  await db.from('profiles').update({ firm_id }).in('id', [ids['attorney@accidentlawyer.ai'], ids['staff@accidentlawyer.ai']]);
  // flag platform super admin
  await db.from('profiles').update({ is_platform_admin: true }).eq('id', ids['super@accidentlawyer.ai']);

  // client records
  const { data: c1 } = await db.from('clients').insert({ profile_id: ids['client1@example.com'], full_name:'Marcus Webb', email:'client1@example.com', dob:'1990-04-12', health_insurer:'BCBS', firm_id }).select();
  const { data: c2 } = await db.from('clients').insert({ profile_id: ids['client2@example.com'], full_name:'Lena Park',  email:'client2@example.com', dob:'2009-08-01', is_minor:true, firm_id }).select(); // minor

  console.log('Creating sample cases…');
  // Case 1: accepted, treating, clean liability
  const { data: case1 } = await db.from('cases').insert({
    firm_id, client_id: c1[0].id, attorney_id: ids['attorney@accidentlawyer.ai'],
    status:'treating', claim:'mva', jurisdiction:'AZ', date_of_loss:'2026-03-10',
    location:'Loop 202 & Rural Rd, Tempe', narrative:'Rear-ended at a red light; neck and back pain.',
    sol_date:'2028-03-10', sol_citation:'A.R.S. § 12-542', fee_phase:'pre_lit', fee_pct:0.3333,
    accepted_fault_pct:100, lead_source:'Google Ads',
  }).select();
  await db.from('insurance_policies').insert([
    { case_id:case1[0].id, kind:'adverse_liability', carrier:'State Farm', limits:25000, verified:true },
    { case_id:case1[0].id, kind:'client_um_uim',     carrier:'Geico',      limits:100000, verified:false },
  ]);
  await db.from('follow_ups').insert([
    { case_id:case1[0].id, label:'24h confirm', due_at:new Date(Date.now()+864e5).toISOString() },
    { case_id:case1[0].id, label:'5 day',  due_at:new Date(Date.now()+5*864e5).toISOString() },
    { case_id:case1[0].id, label:'2 week', due_at:new Date(Date.now()+14*864e5).toISOString() },
    { case_id:case1[0].id, label:'30 day', due_at:new Date(Date.now()+30*864e5).toISOString() },
  ]);
  await db.from('deadlines').insert({ case_id:case1[0].id, type:'sol', due_at:'2028-03-10', label:'Statute of limitations (A.R.S. § 12-542)' });
  await db.from('communications').insert({ case_id:case1[0].id, channel:'email', subject:'We are representing you — what to expect',
    body:'Dear Marcus, we are pleased to represent you for your personal-injury claim…', status:'queued', requires_approval:true, drafted_by:'agent' });
  await db.from('messages').insert({ case_id:case1[0].id, sender_id:ids['attorney@accidentlawyer.ai'], sender_role:'attorney',
    body:'Hi Marcus — welcome aboard. Use this thread any time you have questions about your treatment or your case.' });
  await db.from('settlements').insert({ case_id:case1[0].id, offer_amount:48000, status:'funded' }); // drives super-admin metrics

  // Case 2: new lead under review, minor client, disputed liability + low limits
  const { data: case2 } = await db.from('cases').insert({
    firm_id, client_id: c2[0].id, status:'under_review', claim:'slip_and_fall', jurisdiction:'AZ',
    date_of_loss:'2026-05-02', location:'Grocery store, Mesa', narrative:'Slipped on unmarked wet floor.',
    liability_disputed:true, accepted_fault_pct:50, limits_issue:true, lead_source:'Referral',
  }).select();
  await db.from('conflicts_checks').insert({ case_id:case2[0].id, result:'clear', details:{ checked_names:['Lena Park'], driver_at_fault:false } });

  // --- firm billing (one overdue with late fee, one open with a document-order charge) ---
  const overdueDue = new Date(Date.now()-5*864e5).toISOString();
  const { data: inv1 } = await db.from('invoices').insert({ firm_id, period_label:'April 2026', amount:299, late_fee:25, status:'overdue', due_at:overdueDue }).select().single();
  await db.from('invoice_items').insert([
    { invoice_id:inv1.id, kind:'subscription', description:'Standard plan — April', amount:299 },
    { invoice_id:inv1.id, kind:'late_fee', description:'Late fee (missed payment)', amount:25 },
  ]);
  const { data: inv2 } = await db.from('invoices').insert({ firm_id, period_label:'May 2026', amount:324, status:'open' }).select().single();
  await db.from('invoice_items').insert([
    { invoice_id:inv2.id, kind:'subscription', description:'Standard plan — May', amount:299 },
    { invoice_id:inv2.id, kind:'document_order', description:'Police report order', amount:25 },
  ]);
  await db.from('document_orders').insert({ firm_id, case_id:case1[0].id, type:'police_report', vendor:'AZ DPS', cost:25, status:'received', billed:true });

  // --- legacy client import example ---
  const { data: lc } = await db.from('clients').insert({ full_name:'Robert Vance', email:'rvance@example.com', firm_id, legacy:true }).select().single();
  await db.from('cases').insert({ firm_id, client_id:lc.id, status:'demand', claim:'mva', lead_source:'legacy', date_of_loss:'2025-11-02' });

  // --- pending signature gates case 1 (shows on attorney case + client dashboard) ---
  await db.from('approvals').insert({ case_id:case1[0].id, kind:'release',
    title:'Sign release & settlement statement', requires_signature:true, status:'requested' });

  console.log('\nDone. Test logins (password for all: %s):', PW);
  users.forEach(u => console.log('  •', u.role.padEnd(9), u.email));
}
main().catch(e => { console.error(e); process.exit(1); });
