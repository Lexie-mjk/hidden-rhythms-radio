-- À exécuter une fois EN PLUS de schema.sql, pour autoriser la page /admin à écrire.
--
-- Étape préalable (une seule fois) : créer votre compte admin dans le Dashboard Supabase
--   Authentication > Users > Add user > renseignez un email + mot de passe,
--   cochez "Auto Confirm User" (sinon il faudra confirmer l'email avant de pouvoir se connecter).
-- Utilisez ensuite cet email/mot de passe pour vous connecter sur /admin dans l'app.
--
-- Ces règles n'accordent l'écriture (et la lecture, nécessaire pour l'admin lui-même) qu'aux
-- utilisateurs authentifiés — c'est-à-dire uniquement les comptes que vous créez manuellement
-- dans le Dashboard (il n'y a pas d'inscription publique dans l'app).

create policy "authenticated users can read tracks"
  on public.tracks for select
  to authenticated
  using (true);

create policy "authenticated users can insert tracks"
  on public.tracks for insert
  to authenticated
  with check (true);

create policy "authenticated users can update tracks"
  on public.tracks for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete tracks"
  on public.tracks for delete
  to authenticated
  using (true);

create policy "authenticated users can read soundcloud_artists"
  on public.soundcloud_artists for select
  to authenticated
  using (true);

create policy "authenticated users can insert soundcloud_artists"
  on public.soundcloud_artists for insert
  to authenticated
  with check (true);

create policy "authenticated users can update soundcloud_artists"
  on public.soundcloud_artists for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete soundcloud_artists"
  on public.soundcloud_artists for delete
  to authenticated
  using (true);
