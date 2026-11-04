# Sentinels Cinematic Universe (SCU) — Admin CMS + PDF Lore Ingestion

The project is currently empty, so this builds the SCU app from scratch with the requested admin powers and PDF engine.

## What you'll get

**Public pages (anyone can read)**
- Home — clean editorial intro, floating pill navigation, day/night toggle.
- Characters — card grid; tapping a card expands it into a full dossier (name, alias, role, status badge, bio, lore notes, picture if set).
- Orgs & Bloodlines — organizations, clans, bloodlines, factions with Active/Inactive badges.
- Timeline — ordered events, linked to characters/orgs.

**Admin (only zananrobin@gmail.com)**
- Sign in page.
- On every card/dossier: Edit (modal) and Delete (with confirm).
- "New entity" form for characters, orgs, clans, bloodlines, factions, timeline events.
- Picture upload — only admins can add/change pictures. Ingested entries get no picture.
- Lore Ingest page: upload a story PDF → the AI reads it → you see a **review screen** listing proposed new entries and additions to existing ones → you approve, then it's saved.

## PDF rules (zero fabrication)
- Only names/facts explicitly in the PDF text are extracted; each item carries a quoted source snippet.
- Orgs/clans/bloodlines only created if the text clearly names them as such.
- New characters: name, alias, role, bio from text; picture left empty.
- Existing entries: new facts are **appended** as dated lore notes; fields you edited by hand are locked and never overwritten (status can be suggested, you approve).
- Timeline events from the text are added to the Timeline.

## Design
Minimal luxury editorial: warm off-white / deep ink night mode, serif headings (Cormorant) with clean sans body, thin dividers, no heavy shadows, generous spacing, mobile-first (works on Android and PC).

## Technical details
- Enable Lovable Cloud: tables `entities` (kind enum: character/organization/clan/bloodline/faction, name, alias, role, status, description, stats jsonb, image_url, locked_fields text[]), `lore_notes` (entity_id, text, source_pdf), `timeline_events`, `relations`, `ingest_jobs`, `user_roles` + `has_role()`.
- RLS: public SELECT; INSERT/UPDATE/DELETE only `has_role(auth.uid(),'admin')`. Admin role seeded for zananrobin@gmail.com via trigger on signup.
- Storage bucket `entity-images` (public read, admin write).
- PDF text extracted in browser (pdfjs-dist), sent to an admin-only server function that calls Lovable AI Gateway with structured output (strict schema, existing entity names supplied for matching, instruction to return only text-grounded items with quotes). Server re-verifies each quote appears in the text; unverified items dropped.
- Apply step is a second admin server function that merges respecting `locked_fields`; editing a field manually adds it to `locked_fields`.
- Tests for: merge never overwrites locked fields; ungrounded items rejected.
