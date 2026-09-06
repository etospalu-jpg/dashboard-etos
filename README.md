# ETOS ID Palu Dashboard — Supabase Migration

Production migration of the existing ETOS ID Palu dashboard from Google Apps Script / Google Sheets persistence to Supabase PostgreSQL, Auth, RLS, Storage, Realtime, and Edge Functions.

## Architecture
- Frontend: existing ETOS Tailwind UI, preserved for visual parity
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Authorization: RBAC + Row Level Security
- Public data API: Supabase Edge Function `public-api`
- Public Kajian reflection flow: Supabase Edge Function `public-reflection`
- First admin bootstrap: Supabase Edge Function `bootstrap-admin`
- Sensitive/admin API: Supabase Edge Function `secure-api`
- Deployment target: Vercel

## Supabase
Project URL: `https://weklmapqizeldfdalbgs.supabase.co`

The browser uses a Supabase publishable key only. Never place service-role/secret keys in this repository.

## Deployment
This is a static application. `vercel.json` provides SPA rewrites and keeps public reflection URLs such as `/r/AD8E9E3D` compatible with the existing UI.

## Migration principle
The existing interface is preserved first (parity-first migration), while `google.script.run` is replaced by `supabase-adapter.js`. This allows backend migration without changing the visual behavior users already know.
