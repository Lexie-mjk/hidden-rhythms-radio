-- À exécuter une fois EN PLUS de schema.sql et admin-access.sql.
-- Playlists "maison" (composées de morceaux déjà hébergés dans public.tracks).
-- Les playlists SoundCloud, elles, ne sont PAS stockées ici : elles sont récupérées
-- en direct depuis l'API (voir la Edge Function soundcloud-proxy).

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null default 0,
  primary key (playlist_id, track_id)
);

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

drop policy if exists "playlists are publicly readable" on public.playlists;
create policy "playlists are publicly readable"
  on public.playlists for select
  to anon
  using (true);

drop policy if exists "playlist_tracks are publicly readable" on public.playlist_tracks;
create policy "playlist_tracks are publicly readable"
  on public.playlist_tracks for select
  to anon
  using (true);

drop policy if exists "authenticated users can read playlists" on public.playlists;
create policy "authenticated users can read playlists"
  on public.playlists for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can insert playlists" on public.playlists;
create policy "authenticated users can insert playlists"
  on public.playlists for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated users can update playlists" on public.playlists;
create policy "authenticated users can update playlists"
  on public.playlists for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users can delete playlists" on public.playlists;
create policy "authenticated users can delete playlists"
  on public.playlists for delete
  to authenticated
  using (true);

drop policy if exists "authenticated users can read playlist_tracks" on public.playlist_tracks;
create policy "authenticated users can read playlist_tracks"
  on public.playlist_tracks for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can insert playlist_tracks" on public.playlist_tracks;
create policy "authenticated users can insert playlist_tracks"
  on public.playlist_tracks for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated users can delete playlist_tracks" on public.playlist_tracks;
create policy "authenticated users can delete playlist_tracks"
  on public.playlist_tracks for delete
  to authenticated
  using (true);
