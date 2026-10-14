ALTER TABLE public.asrama_sync_settings ADD COLUMN IF NOT EXISTS last_connector_at timestamptz;
