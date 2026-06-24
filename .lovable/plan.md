# CivicLens – Map stability, full Myanmar i18n, and Admin Operations Center

This is a large request. To ship it safely I'll split it into **3 phases**. Each phase is independently testable and leaves the app in a working state. I'll confirm before moving to the next phase.

---

## Phase 1 — Stability, i18n, validation (this turn)

Small, surgical fixes the user is hitting today.

1. **Map never freezes**
   - Wrap `/map` route in a `<Suspense>` + lightweight skeleton; lazy-load Leaflet so the menu animation isn't blocked.
   - Add `body { overflow: hidden }` lock only while the map mounts (cleanup on unmount) to stop scroll-chaining freeze on mobile.
   - Force `.leaflet-container { z-index: 0; isolation: isolate; position: relative }` and keep mobile sidebar at `z-[1200]`.
   - Guard `navigator.geolocation` calls behind `try/catch` + 6 s timeout so a hung GPS request can't block render.

2. **AI image validation – resolution fully excluded**
   - Re-audit `src/lib/image-utils.ts` + `src/lib/ai-validation.functions.ts`. Remove any remaining width/height/megapixel checks and any prompt language that mentions resolution.
   - Keep & sharpen: format, file-size, integrity, duplicate-hash, manipulation/AI-generated detection, blur/quality (perceptual, not pixel-count).
   - Every rejection returns a single human reason string already localized via i18n key.

3. **Full Myanmar translation pass**
   - Extend `src/lib/i18n.ts` MY dictionary with every remaining English string: status badges (`pending/analyzing/verified/resolved/rejected`), category labels, department names, chart tooltip labels, admin table headers, empty-states, toast messages, button labels.
   - Apply `t()` everywhere those literals appear (`admin.tsx`, `admin.users.tsx`, `admin.audit.tsx`, `dashboard.tsx`, `reports.*`, `notifications.tsx`, `map.tsx`, chart components).
   - Numbers already use `localNum()` — extend to remaining counters/dates.

---

## Phase 2 — Admin Operations Core (next turn)

Foundational data model + UI for the workflow you described.

1. **Schema** (one migration):
   - `departments` table — seeded with Roads / Electricity / Water / Sanitation / Parks / Public Safety / IT / Emergency Response (with i18n name_my).
   - `reports`: add `priority` (critical/high/medium/low), `department_id`, `deadline_at`, `is_overdue` (generated), `work_order_no` (auto `WO-####`), `resolved_at`.
   - `work_order_activity` table — comments + mentions + attachments per WO.
   - `report_feedback` table — 1-5 star + comment, one per resolved report by uploader.
   - SLA trigger: on priority set → `deadline_at = now() + (24h/3d/7d/14d)`; nightly cron flips `is_overdue`.
2. **Reporter UX**
   - Department dropdown (seeded list) replaces free-text on `reports.new.tsx`.
   - Smart auto-suggest department from category (client-side mapping, admin can override).
3. **Admin panel**
   - User management already lists users — add bulk role grant + confirmation, surface in nav.
   - Wire audit log writes for: priority change, department assignment, work-order create, deadline override, feedback moderation. (Reads already work.)
   - Per-report admin drawer: assign department, set priority, view auto-generated WO #, deadline countdown, overdue badge.

---

## Phase 3 — Command Center & intelligence (later turn)

1. **Executive dashboard** `/admin/command` — KPI cards (open / critical / overdue / avg resolution), department leaderboard, cost roll-up, Leaflet heatmap of hotspots.
2. **Department KPIs page** — per-department: avg resolution time, resolved count, open, overdue, citizen rating average.
3. **Cost & resources** — `cost_estimates` (est/actual/budget_source) + `resource_allocations` (vehicles/contractors/equipment) tables, admin-only edit.
4. **Escalation engine** — pg_cron job: when `deadline_at < now()` and status not in (resolved/rejected) → bump priority one tier, insert notification + audit row, email admins.
5. **AI predictions** — server fn that calls Lovable AI to summarize trend ("rainy-season road issues likely up X%"), shown on command center.
6. **Citizen feedback loop** — after status flips to resolved, uploader sees star-rating modal; feedback feeds KPI.

---

## Technical notes

- All new tables: `public` schema, `GRANT` block, RLS, `service_role` full access, `authenticated` scoped via `has_role()`.
- Work-order numbering: Postgres sequence `work_order_seq`, formatted `WO-` || lpad(nextval, 4, '0').
- Auto-assignment mapping lives in `src/lib/categories.ts` next to existing `getCategoryLabel` so admin override stays trivial.
- No new external services; emails reuse the queue you set up on `notify.naithkumer.com`.
- Heatmap uses `leaflet.heat` (already lazy-loaded with the map bundle).

---

## What ships this turn

Only **Phase 1**. After you confirm map is stable + Myanmar reads cleanly, I'll start Phase 2 (schema + admin workflow), then Phase 3 (command center).

Reply **"go phase 1"** to start, or tell me what to reorder.