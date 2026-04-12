-- Realtime INSERT/UPDATE/DELETE on lobby_members so waiting-room UIs can refetch the player list.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lobby_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_members;
  END IF;
END $$;
