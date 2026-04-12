-- Broadcast lobby row changes so clients can react to DELETE (e.g. host removed lobby from hub).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lobbies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
  END IF;
END $$;
