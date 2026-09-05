const clientId = process.env.EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID;

if (!clientId) {
  throw new Error('EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID doit être défini (voir .env.example).');
}

const API_BASE = 'https://api.soundcloud.com';

export type SoundCloudUser = {
  id: number;
  username: string;
  permalink_url: string;
  avatar_url: string | null;
  description: string | null;
};

export type SoundCloudTrack = {
  id: number;
  title: string;
  permalink_url: string;
  artwork_url: string | null;
  duration: number;
  genre: string | null;
  streamable: boolean;
  embeddable_by: string;
};

async function scGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('client_id', clientId as string);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SoundCloud API ${path} a échoué (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/**
 * Résout un profil artiste à partir de son URL publique SoundCloud
 * (ex: https://soundcloud.com/nom-artiste), stockée dans Supabase.
 */
export function resolveArtistByUrl(permalinkUrl: string): Promise<SoundCloudUser> {
  return scGet<SoundCloudUser>('/resolve', { url: permalinkUrl });
}

export function fetchArtistTracks(userId: number): Promise<SoundCloudTrack[]> {
  return scGet<SoundCloudTrack[]>(`/users/${userId}/tracks`, { limit: '50' });
}

/**
 * Ne jamais utiliser /tracks/{id}/streams : l'accès au streaming brut est restreint
 * par SoundCloud pour la plupart des apps. La lecture passe par le Widget officiel.
 */
export function buildWidgetUrl(trackPermalinkUrl: string): string {
  const url = new URL('https://w.soundcloud.com/player/');
  url.searchParams.set('url', trackPermalinkUrl);
  url.searchParams.set('auto_play', 'true');
  url.searchParams.set('visual', 'false');
  url.searchParams.set('show_comments', 'false');
  url.searchParams.set('show_user', 'true');
  return url.toString();
}
