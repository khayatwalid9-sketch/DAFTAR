# Changelog

## v3.5 — Mobile, column chooser, "Call today" (no DB changes)
- Dashboard: new top panel "Call today" (broken promises → promises due today → overdue by balance; Call / Open buttons).
- Debtors table: column chooser (Notes / Last contact / Days since payment hidden by default). Choice is kept for the session only.
- Mobile: one-row header, filters in a bottom sheet (tap outside or Apply to close), floating + button, table reduced to Name / Remaining / Status / Actions.
- Verified in headless Chromium (17 functional checks + layout measurements). Not done: remembering column choice across reloads; Arabic/dark visual check.

## v3.4 — Design pass (no DB changes)
- Fixed: advanced-search panel was open by default and its button hid it; now collapsed by default, laid out as a grid (date range no longer overlaps).
- Fixed: hard-coded Arabic placeholders (من / إلى) are now translated; native selects restyled and toolbar controls aligned.
- Debtors table: phone no longer wraps; actions column stays visible while the table scrolls; status badges no longer wrap.
- Dashboard: red kept for danger only (neutral card accents, overdue card highlighted); tabular figures for amounts.
- Debtor drawer: sticky summary (remaining amount, progress bar, status, jump buttons to Record payment / Promise to pay).
- Verified in headless Chromium (17 functional checks + screenshots). Not done: mobile header compaction, column chooser, bottom-sheet filters, floating add button.

## v3.3 — Edit-conflict detection + live refresh
- Each debtor/quotation row carries a server-maintained `updated_at`. Before overwriting a row, the app compares it with what the server has; if another user changed it, saving stops and the user chooses: load the latest version, overwrite, or keep editing. Nothing is overwritten silently any more.
- Live refresh every 30 s (and when the tab regains focus), only when this session has no unsaved edits and no drawer/modal is open.
- **Run `supabase/conflict-detection-migration.sql` BEFORE deploying v3.3.** Without it the app behaves as in v3.2 (no conflict check).
- Tested in headless Chromium against a mocked Supabase (17 checks: promise-to-pay, backup, conflict scenarios, live refresh). Not tested against a real Supabase project. Quotation conflicts use the same code path but had no dedicated check.
- Still not done: ES-module split of `app.js`, integer-money storage, scheduled reports (needs an email service).

## v3.2 — Promise to pay + backup
- Promise to pay (وعد الدفع): one open promise per debtor (date + amount) in the debtor drawer; badge in the debtors table/cards (upcoming / today / broken); bell notifications for promises due today and broken ones. A promise stops counting once the debtor is fully paid.
- Admin-only full backup: Settings › Backup downloads every table as one JSON file (API-key row excluded). Nothing is stored in the browser.
- **Run `supabase/promise-to-pay-migration.sql` BEFORE deploying v3.2** (adds `promise_date`, `promise_amount` to `debtors`; without it saving debtors fails).
- Not done: conflict detection / live refresh, ES-module split of `app.js`, integer-money storage, scheduled reports.

## v3.1 — Deployment fixes
- `fonts/fonts.css`: font URLs were relative to the CSS file (`/fonts/fonts/…`, 404); now correct.
- Login screen shows a specific message when `vendor/` is missing from the deployment instead of the generic "cloud database unavailable".
- Deploy the WHOLE folder (including `vendor/` and `fonts/`): `script-src 'self'` means nothing is loaded from a CDN.

## v3 — Security, no-browser-storage, brand redesign
**Security**
- Real auth: Supabase Auth + Row Level Security (`supabase/secure-auth-migration.sql`); plaintext `users.password` and every `using (true)` policy removed; anon key sees nothing.
- User management via `admin-users` Edge Function (service_role never in the browser); last-admin protection.
- Client: login lockout (5 tries → 30 s), no data requested before sign-in, sync blocked until a successful load, role-aware sync (viewer/collector never attempt forbidden writes).
- API keys moved to an admin-only settings row; audit log is insert-only; attachments bucket is private with 5-minute signed URLs.
- CSP (`script-src 'self'`), HSTS, X-Frame-Options, Permissions-Policy; all libraries and fonts self-hosted (no CDN); removed `window.debugAuth/resetLogin`.

**No local storage**
- Removed every `localStorage`/`sessionStorage` use. Session in memory only; appearance saved per user in the database; legacy browser leftovers are purged on load.

**Design**
- Brand palette from the UltraCrete logo (red + graphite); renamed `--gold` → `--accent`; AA-safe text tokens per mode (fixed ratios as low as 2.0:1); palettes trimmed 13 → 5.
- SVG icon set (replaced mixed emoji/glyphs; fixed the duplicate ☰); single font family (IBM Plex Sans Arabic, tabular numerals).
- Dashboard: "needs attention today" first, 4 headline KPIs, compact secondary row, 2-column charts; removed fabricated trend numbers (real month-over-month now).
- Mobile bottom tab bar; nav items are real buttons; dialogs get role/aria-modal/focus trap/focus restore; skip link; focus-visible; reduced motion.
- Login: real logo, show/hide password. Debtor drawer: WhatsApp reminder (wa.me, +974 normalised).

**Engineering**
- Translations split into `i18n.js`; sample data removed from memory (nothing can be uploaded by accident).
- 19 behavioural tests (jsdom + Supabase mock) replace the source-text regex tests.
- Row-level sync: only new/changed rows are upserted and only rows this session removed are deleted; rows added by other users are never touched (previously a stale session could overwrite or delete them).

## Not done (deliberately)
Full ES-module split of `app.js`; conflict detection when two users edit the *same* row (last write still wins) and live refresh; integer-money storage; promise-to-pay, post-dated cheques, dunning automation, scheduled e-mail reports; PWA/offline (conflicts with the no-local-storage requirement).
