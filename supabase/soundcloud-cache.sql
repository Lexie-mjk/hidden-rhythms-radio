-- Cache persistant du token OAuth2 SoundCloud pour la Edge Function soundcloud-proxy.
--
-- Sans ce cache, chaque redémarrage à froid de la fonction (fréquent vu le faible trafic)
-- redemandait un nouveau token à SoundCloud, ce qui a fini par déclencher un 429
-- ("trop de requêtes") sur leur endpoint d'authentification. Une seule ligne, jamais lue
-- ou écrite que par la Edge Function via la clé service_role (qui contourne RLS) —
-- aucune policy n'est ajoutée pour anon/authenticated, donc cette table leur reste
-- totalement inaccessible.

create table if not exists public.soundcloud_oauth_cache (
  id smallint primary key default 1,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  constraint soundcloud_oauth_cache_single_row check (id = 1)
);

-- Idempotent : ajoute la colonne si la table existait déjà sans elle.
alter table public.soundcloud_oauth_cache add column if not exists refresh_token text;

alter table public.soundcloud_oauth_cache enable row level security;
