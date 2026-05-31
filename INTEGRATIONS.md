# Integrations — what each one needs from you

These four connect through **Supabase Edge Functions** (serverless), not the browser app.
Secrets (API keys, OAuth client secrets, refresh tokens) live in the edge-function
environment — never in the React code or the database. The `integrations` table only stores
non-secret config and a `connected` flag per firm.

The app already has the connection points (the `integrations`, `calendar_events`, and
`backup_runs` tables, plus the messaging thread and approval inbox). Wiring is the next pass,
and it's blocked only on the accounts/keys below.

## 1. SendGrid (outbound email)
- **You provide:** SendGrid account, API key, a verified sender domain (SPF/DKIM).
- **Where it plugs in:** the Approval inbox. "Approve & release" calls an edge function that
  sends the queued email via SendGrid and stamps `communications.sent_at`.
- **Decision:** which from-address per firm; do clients reply by email into the case thread?

## 2. Twilio (SMS / texts)
- **You provide:** Twilio account SID + auth token, a messaging-service or phone number.
- **Where it plugs in:** follow-up cadence (24h/5d/2w/30d) and message-thread notifications.
  Inbound SMS hits a Twilio webhook → edge function → inserts a `messages` row.
- **Decision:** one shared number or per-firm numbers; opt-in/STOP handling (the client
  engagement consent already captures texting permission).

## 3. Google Calendar + Meet (meetings, offline fallback)
- **You provide:** a Google Cloud project, OAuth client (consent screen), Calendar API enabled.
- **Where it plugs in:** `calendar_events` mirrors firm deadlines/meetings to Google so they're
  reachable even if the app is down; creating an event returns a Meet link stored on the row.
- **Decision:** per-attorney Google OAuth (each connects their own calendar) vs. a firm service
  account. Per-attorney is the usual answer for "access their own calendar if the site is down."

## 4. Dropbox (client-file backup + client list + deadlines)
- **You provide:** Dropbox app (App Console), OAuth, a backup folder convention.
- **Where it plugs in:** a scheduled edge function reads each firm's documents + client list +
  deadlines and writes them to that firm's Dropbox; runs are logged in `backup_runs`.
- **Decision:** backup frequency (nightly?), and whether file backup is per-firm Dropbox
  (firm connects their own) or a platform-owned Dropbox with per-firm folders.

---

### Suggested order
SendGrid first (it makes the acceptance email real and is the simplest), then Twilio
(follow-ups), then Google (calendar/Meet), then Dropbox (backup). Each is an isolated edge
function, so they can land one at a time without touching the rest of the app.

## 5. Stripe (firm SaaS billing)
- **You provide:** Stripe account, secret key, a product/price for the subscription, and a webhook secret.
- **Where it plugs in:** the Account & billing page. "Pay now" currently records a payment row;
  with Stripe it charges the saved card. A scheduled function issues monthly invoices (subscription
  + any unbilled `document_orders`), assesses late fees past 30 days, and flips
  `firms.account_status` to `past_due` then `suspended` — which the database already enforces as
  loss of file access. A Stripe webhook marks invoices paid and restores access.
- **Decision:** plan price(s); grace window before suspension; late-fee amount.

## 6. E-signature (releases, fee agreements)
- **Options:** in-app signature capture (typed name + timestamp, already built into the approvals
  flow) is fine for many approvals; for releases you may want **DocuSign** for a stronger audit
  trail and certificate.
- **You provide (if DocuSign):** account, integration key, and OAuth.
- **Where it plugs in:** the Approvals & signatures tab. Requesting a signed release would create a
  DocuSign envelope; the signed PDF lands back in the case file cabinet and flips the approval to
  `signed`.
- **Decision:** in-app signing vs DocuSign for legally significant documents (releases especially).
