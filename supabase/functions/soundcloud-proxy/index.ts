// Proxy des appels de métadonnées SoundCloud : détient le client_secret (jamais exposé
// côté client) et échange le token OAuth2 client_credentials désormais exigé par SoundCloud.
// Ne sert jamais à la lecture audio — celle-ci passe par le Widget public (WebView), qui
// n'a pas besoin de ce token.
//
// Déploiement : supabase functions deploy soundcloud-proxy
// Secrets requis : supabase secrets set SOUNDCLOUD_CLIENT_ID=... SOUNDCLOUD_CLIENT_SECRET=...

import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors';

const SOUNDCLOUD_CLIENT_ID = Deno.env.get('SOUNDCLOUD_CLIENT_ID');
const SOUNDCLOUD_CLIENT_SECRET = Deno.env.get('SOUNDCLOUD_CLIENT_SECRET');

type ScTrack = { id: number; permalink_url?: string; [key: string]: unknown };
type ScPlaylist = { tracks?: ScTrack[]; [key: string]: unknown };

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!SOUNDCLOUD_CLIENT_ID || !SOUNDCLOUD_CLIENT_SECRET) {
    throw new Error(
      'SOUNDCLOUD_CLIENT_ID et SOUNDCLOUD_CLIENT_SECRET doivent être configurés (supabase secrets set).'
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }
  const response = await fetch('https://api.soundcloud.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SOUNDCLOUD_CLIENT_ID,
      client_secret: SOUNDCLOUD_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!response.ok) {
    throw new Error(`Échec de l'obtention du token SoundCloud (${response.status})`);
  }
  const data = await response.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
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
