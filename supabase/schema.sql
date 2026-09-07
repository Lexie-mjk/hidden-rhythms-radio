-- À exécuter une fois dans l'éditeur SQL de votre projet Supabase (Studio > SQL Editor).
-- Catalogue propre du collectif (radio) + liste curatée des artistes SoundCloud.

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_name text not null,
  audio_url text not null,
  cover_url text,
  duration_seconds integer,
  tags text[],
  created_at timestamptz not null default now()
);

create table if not exists public.soundcloud_artists (
  id uuid primary key default gen_random_uuid(),
  soundcloud_permalink_url text not null unique,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Lecture publique uniquement : l'app ne fait que lire, l'ajout de contenu se fait
-- depuis Supabase Studio (avec la clé service_role, qui n'est jamais exposée côté client).
alter table public.tracks enable row level security;
alter table public.soundcloud_artists enable row level security;

drop policy if exists "tracks are publicly readable" on public.tracks;
create policy "tracks are publicly readable"
  on public.tracks for select
  to anon
  using (true);

drop policy if exists "soundcloud_artists are publicly readable" on public.soundcloud_artists;
create policy "soundcloud_artists are publicly readable"
  on public.soundcloud_artists for select
  to anon
  using (true);

-- Bucket de stockage public pour les fichiers audio et pochettes du catalogue propre.
insert into storage.buckets (id, name, public)
values ('tracks', 'tracks', true)
on conflict (id) do nothing;

drop policy if exists "tracks bucket is publicly readable" on storage.objects;
create policy "tracks bucket is publicly readable"
  on storage.objects for select
  to anon
  using (bucket_id = 'tracks');
