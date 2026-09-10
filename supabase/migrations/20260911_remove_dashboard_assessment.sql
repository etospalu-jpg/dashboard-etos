-- ETOS ID Palu Dashboard v36
-- Assessment feature was retired from this dashboard.
-- This migration intentionally targets only the dashboard assessment table.
-- The separate ETOS Assessment Center project is not affected.
-- Intentionally no CASCADE: unexpected dependencies must be reviewed explicitly.

drop table if exists public.assessments;
