// Proxy des appels de métadonnées SoundCloud : détient le client_secret (jamais exposé
// côté client) et échange le token OAuth2 client_credentials désormais exigé par SoundCloud.
// Ne sert jamais à la lecture audio — celle-ci passe par le Widget public (WebView), qui
// n'a pas besoin de ce token.
//
// Déploiement : supabase functions deploy soundcloud-proxy
// Secrets requis : supabase secrets set SOUNDCLOUD_CLIENT_ID=... SOUNDCLOUD_CLIENT_SECRET=...
// Nécessite aussi la table public.soundcloud_oauth_cache (voir supabase/soundcloud-cache.sql).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors';

const SOUNDCLOUD_CLIENT_ID = Deno.env.get('SOUNDCLOUD_CLIENT_ID');
const SOUNDCLOUD_CLIENT_SECRET = Deno.env.get('SOUNDCLOUD_CLIENT_SECRET');

// Variables injectées automatiquement par Supabase dans toute Edge Function (pas besoin de
// les configurer via `supabase secrets set`). SUPABASE_SERVICE_ROLE_KEY est le nom historique ;
// SUPABASE_SECRET_KEYS (JSON) est le nouveau format — on gère les deux.
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type ScTrack = { id: number; permalink_url?: string; [key: string]: unknown };
type ScPlaylist = { tracks?: ScTrack[]; [key: string]: unknown };

// Cache mémoire local à l'instance (rapide tant qu'elle reste "chaude"), doublé d'un cache
// en base (table soundcloud_oauth_cache) qui survit aux redémarrages à froid. Sans ce second
// niveau, chaque redémarrage à froid redemandait un token à SoundCloud, ce qui a fini par
// déclencher un 429 ("trop de requêtes") sur leur endpoint d'authentification — SoundCloud
// limite ce type de token à 50/12h par app et 30/h par IP.
let cachedToken: { accessToken: string; refreshToken: string | null; expiresAt: number } | null =
  null;

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch('https://api.soundcloud.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`Échec de l'obtention du token SoundCloud (${response.status})`);
  }
  return response.json();
}

async function persistToken(data: TokenResponse, expiresAt: number) {
  cachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
  };
  await supabaseAdmin.from('soundcloud_oauth_cache').upsert({
    id: 1,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_at: new Date(expiresAt).toISOString(),
  });
}

async function getAccessToken(): Promise<string> {
  if (!SOUNDCLOUD_CLIENT_ID || !SOUNDCLOUD_CLIENT_SECRET) {
    throw new Error(
      'SOUNDCLOUD_CLIENT_ID et SOUNDCLOUD_CLIENT_SECRET doivent être configurés (supabase secrets set).'
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.accessToken;
  }

  if (!cachedToken) {
    const { data: cachedRow } = await supabaseAdmin
      .from('soundcloud_oauth_cache')
      .select('access_token, refresh_token, expires_at')
      .eq('id', 1)
      .maybeSingle();

    if (cachedRow) {
      cachedToken = {
        accessToken: cachedRow.access_token,
        refreshToken: cachedRow.refresh_token,
        expiresAt: new Date(cachedRow.expires_at).getTime(),
      };
      if (cachedToken.expiresAt > now + 30_000) {
        return cachedToken.accessToken;
      }
    }
  }

  // Le token a expiré (ou n'existait pas) : SoundCloud recommande de le renouveler via
  // refresh_token plutôt que de redemander un nouveau token client_credentials à chaque fois
  // (ce dernier compte dans un quota bien plus restreint).
  if (cachedToken?.refreshToken) {
    try {
      const data = await requestToken(
        new URLSearchParams({
          client_id: SOUNDCLOUD_CLIENT_ID,
          client_secret: SOUNDCLOUD_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: cachedToken.refreshToken,
        })
      );
      await persistToken(data, now + data.expires_in * 1000);
      return data.access_token;
    } catch {
      // refresh_token invalide/expiré : on retente avec un nouveau token ci-dessous.
    }
  }

  const data = await requestToken(
    new URLSearchParams({
      client_id: SOUNDCLOUD_CLIENT_ID,
      client_secret: SOUNDCLOUD_CLIENT_SECRET,
      grant_type: 'client_credentials',
    })
  );
  await persistToken(data, now + data.expires_in * 1000);
  return data.access_token;
}

async function soundcloudGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`https://api.soundcloud.com${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url.toString(), { headers: { Authorization: `OAuth ${token}` } });
  if (!response.ok) {
    throw new Error(`SoundCloud API ${path} a échoué (${response.status})`);
  }
  return response.json() as Promise<T>;
}

// Les morceaux embarqués dans une playlist n'ont pas toujours permalink_url (représentation
// "mini") : on complète individuellement ceux qui en ont besoin pour que la lecture via le
// Widget fonctionne ensuite côté client.
async function hydrateTrack(track: ScTrack): Promise<ScTrack> {
  if (track.permalink_url) return track;
  return soundcloudGet<ScTrack>(`/tracks/${track.id}`);
}

async function handleRequest(action: string, params: Record<string, string>) {
  switch (action) {
    case 'resolve-user': {
      if (!params.url) throw new Error('paramètre "url" manquant');
      return soundcloudGet('/resolve', { url: params.url });
    }
    case 'user-tracks': {
      if (!params.userId) throw new Error('paramètre "userId" manquant');
      return soundcloudGet(`/users/${params.userId}/tracks`, { limit: '50' });
    }
    case 'user-playlists': {
      if (!params.userId) throw new Error('paramètre "userId" manquant');
      const playlists = await soundcloudGet<ScPlaylist[]>(`/users/${params.userId}/playlists`, {
        limit: '50',
      });
      return Promise.all(
        playlists.map(async (playlist) => ({
          ...playlist,
          tracks: await Promise.all((playlist.tracks ?? []).map(hydrateTrack)),
        }))
      );
    }
    default:
      throw new Error(`action inconnue: ${action}`);
  }
}

export default {
  fetch: async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const { action, ...params } = await req.json();
      const data = await handleRequest(action, params);
      return Response.json(data, { headers: corsHeaders });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Response.json({ error: message }, { status: 400, headers: corsHeaders });
    }
  },
};
