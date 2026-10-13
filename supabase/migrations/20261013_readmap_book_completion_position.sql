-- READMAP: dedicated position in each book, independent of pages read per week.
-- Additive only: existing books, entries, accounts and videos remain unchanged.
ALTER TABLE public.readmap_books
 ADD COLUMN IF NOT EXISTS current_page integer NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='readmap_books_current_page_valid' AND conrelid='public.readmap_books'::regclass) THEN
  ALTER TABLE public.readmap_books ADD CONSTRAINT readmap_books_current_page_valid
  CHECK (current_page BETWEEN 0 AND 20000 AND (total_pages IS NULL OR current_page <= total_pages));
 END IF;
END $$;
COMMENT ON COLUMN public.readmap_books.current_page IS
 'Highest page position confirmed by the reader, not accumulated pages read. Completion percent is current_page/total_pages; cumulative weekly activity is independent.';
