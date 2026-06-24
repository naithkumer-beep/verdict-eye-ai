
This is a large request — 10+ features touching schema, UI, AI, maps, i18n, and realtime. Here's how I'll ship it in focused phases so each piece is verified working before stacking the next.

## Phase A — Brand + Header (this turn)
- Upload the **CivicLens AI** logo as a CDN asset and swap `BrandMark` everywhere (sidebar, landing, auth pages, favicon, meta titles).
- Rebrand "CIAP" → "CivicLens AI", taglines/copy refocused on **Yangon, Myanmar** civic reporting.
- Header: add language switcher (EN / မြန်မာ) + Emergency Call button.

## Phase B — Localization (EN / Myanmar)
- Add lightweight i18n (`react-i18next`) with two locales: `en` and `my`.
- Translate nav, dashboard, reports, auth, settings. Persist choice in localStorage.

## Phase C — Map + Yangon focus
- Add latitude/longitude columns to `reports` (migration). New report form auto-geolocates + lets user pin on map.
- New `/map` route with **Leaflet + OpenStreetMap** (free, no API key) centered on Yangon (16.8409, 96.1735), markers colored by status. Both users and admins can view. Detail page shows mini-map.

## Phase D — Engagement: comments + reactions
- New tables: `report_comments`, `report_reactions` (like/dislike, unique per user+report) with RLS + GRANTs.
- Comment thread + Like/Dislike counters on report detail page, realtime updates.

## Phase E — Permissions + status workflow
- Tighten RLS: **only owner or admin** can delete a report (moderators cannot).
- **Only admin** can change `status`. When admin sets status to `resolved`, trigger inserts a notification for the uploader ("Your report has been resolved").
- Admin panel gets status dropdown + delete button.

## Phase F — Profile photo
- Add `avatar_url` to `profiles`. Settings page: upload avatar to existing `report-images` bucket (or new `avatars` bucket) with size/type validation. Show avatar in sidebar + comments.

## Phase G — Emergency call system
- `/emergency` page with Yangon-specific numbers: Police 199, Fire 191, Ambulance 192, YCDC hotline 1888, Electricity 1910, plus tel: links and one-tap dial on mobile. Floating Emergency button in header.

## Phase H — AI chatbot
- Floating chat widget powered by Lovable AI Gateway (Gemini 3 Flash) with a system prompt that knows the CivicLens AI feature set, Yangon context, and answers FAQs bilingually.

## Technical notes
- New migrations: lat/lng on reports, comments table, reactions table, avatar_url on profiles, resolved-notification trigger, tightened delete/update policies.
- New deps: `leaflet`, `react-leaflet`, `react-i18next`, `i18next`.
- Map uses OSM tiles (no key). Chatbot uses existing Lovable AI key.

## Question before I start
Phase A alone is ~1 turn. The full set is 6–8 focused turns. **Should I:**
1. **Ship everything end-to-end across multiple turns** (recommended for the hackathon), or
2. **Start with a specific subset** you want first (tell me which phases)?

Also: confirm OK to use **free OpenStreetMap tiles** for the map (no Google Maps key needed). If you want Google Maps instead I'll wire the connector.
