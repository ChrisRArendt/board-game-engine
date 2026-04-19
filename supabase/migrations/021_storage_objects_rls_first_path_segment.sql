-- Use split_part(name, '/', 1) for owner check instead of (storage.foldername(name))[1].
-- Some deployments evaluate foldername() oddly for nested paths (uid/game_id/media/file),
-- causing INSERT on storage.objects to fail RLS even when the first segment is auth.uid().

drop policy if exists "custom-game-assets: upload own folder" on storage.objects;
drop policy if exists "custom-game-assets: update own folder" on storage.objects;
drop policy if exists "custom-game-assets: delete own folder" on storage.objects;

create policy "custom-game-assets: upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'custom-game-assets'
    and split_part(coalesce(name, ''), '/', 1) = (select auth.uid()::text)
  );

create policy "custom-game-assets: update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'custom-game-assets'
    and split_part(coalesce(name, ''), '/', 1) = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'custom-game-assets'
    and split_part(coalesce(name, ''), '/', 1) = (select auth.uid()::text)
  );

create policy "custom-game-assets: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'custom-game-assets'
    and split_part(coalesce(name, ''), '/', 1) = (select auth.uid()::text)
  );
