-- Allow lobby members to update sort_order on any row in that lobby (waiting-room reorder).
-- Mirrors what security definer RPC does; used as client fallback when PostgREST cache omits the RPC.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lobby_members'
      AND policyname = 'Lobby members can update member order'
  ) THEN
    CREATE POLICY "Lobby members can update member order"
      ON public.lobby_members
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.lobby_members self
          WHERE self.lobby_id = lobby_members.lobby_id
            AND self.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.lobby_members self
          WHERE self.lobby_id = lobby_members.lobby_id
            AND self.user_id = auth.uid()
        )
      );
  END IF;
END $$;
