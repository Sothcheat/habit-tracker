-- =============================================================================
-- Habit Tracker — profile avatars
--
-- Adds profiles.avatar_url and the storage bucket the images live in.
--
-- What is stored where:
--   * The file goes to the 'avatars' bucket under '<user_id>/<uuid>.<ext>'.
--     The first path segment is the owner's id — that is what the policies
--     below check, so a user can only write inside their own folder.
--   * profiles.avatar_url holds the object *path*, not a full URL. The bucket's
--     public URL prefix is a property of the project, not of the user, so
--     baking it into every row would mean rewriting every row if the bucket
--     ever moves. The client resolves it with getPublicUrl().
--   * The filename is a fresh uuid on every upload, not a fixed 'avatar.webp'.
--     A public bucket is served through a CDN, and a stable path would keep
--     serving the previous image after a change. The old object is deleted by
--     the client once the new path is saved.
--
-- The bucket is public: reads need no policy and no signed URL, which keeps
-- avatars to a plain <img src>. Writes are still gated by the policies below.
-- =============================================================================

alter table public.profiles
  add column avatar_url text;

comment on column public.profiles.avatar_url is
  'Object path within the public "avatars" storage bucket, as <user_id>/<uuid>.<ext> — webp, or jpg where the browser cannot encode webp. Null means no avatar. Not a full URL: resolve with getPublicUrl().';

-- -----------------------------------------------------------------------------
-- The bucket
--
-- file_size_limit is 2 MiB. It is a backstop, not the real constraint: the
-- client downscales to 512x512 WebP before uploading, which lands well under
-- 100 KB. 2 MiB leaves room for an unresized phone photo to still succeed if
-- that path ever fails, while ruling out anyone parking a video here.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Write policies
--
-- storage.objects is one table shared by every bucket, and Supabase ships it
-- with RLS already on — so each policy has to name its own bucket_id, and a
-- missing policy means "denied", not "open". Unlike the public tables, this
-- one may already carry policies of these names from the Studio UI, hence the
-- drops.
--
-- No select policy: the bucket is public, so reads never reach RLS.
-- -----------------------------------------------------------------------------

drop policy if exists "avatars: insert own" on storage.objects;
drop policy if exists "avatars: update own" on storage.objects;
drop policy if exists "avatars: delete own" on storage.objects;

create policy "avatars: insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
