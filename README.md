# ETOS ID Palu Dashboard

Awardee development intelligence dashboard for ETOS ID Palu.

## Runtime

- Frontend: static HTML/CSS/JavaScript
- Backend: Vercel Functions + Supabase
- Production domain: https://etosidpalu.vercel.app

## Data

Public dashboard data is served from Supabase. IDP Palu supports a replace-upload workflow for the active `.xlsx` workbook; the active parsed workbook is stored in Supabase and remains available across refreshes and deployments.

## Security

Operational actions require authorized access. Public views remain read-only.
