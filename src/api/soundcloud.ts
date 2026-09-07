import { supabase } from '@/api/supabase';

// SoundCloud exige désormais un token OAuth2 (client_credentials) pour tout appel de métadonnées,
// ce qui nécessite un client_secret — un vrai secret, jamais embarqué côté app. Ces appels passent
// donc par une Supabase Edge Function (voir supabase/functions/soundcloud-proxy) qui détient ce
// secret et fait le proxy. La lecture audio (Widget WebView) n'est pas concernée : elle reste publique.

const accountUrl = process.env.EXPO_PUBLIC_SOUNDCLOUD_ACCOUNT_URL;

if (!accountUrl) {
  throw new Error('EXPO_PUBLIC_SOUNDCLOUD_ACCOUNT_URL doit être défini (voir .env.example).');
}

export const HIDDEN_RHYTHMS_ACCOUNT_URL = accountUrl;

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

export type SoundCloudPlaylist = {
  id: number;
  title: string;
  permalink_url: string;
  artwork_url: string | null;
  track_count: number;
  tracks: SoundCloudTrack[];
};

async function callProxy<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('soundcloud-proxy', {
    body: { action, ...params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function resolveArtistByUrl(permalinkUrl: string): Promise<SoundCloudUser> {
  return callProxy<SoundCloudUser>('resolve-user', { url: permalinkUrl });
}

export function fetchArtistTracks(userId: number): Promise<SoundCloudTrack[]> {
  return callProxy<SoundCloudTrack[]>('user-tracks', { userId: String(userId) });
}

function fetchUserPlaylists(userId: number): Promise<SoundCloudPlaylist[]> {
  return callProxy<SoundCloudPlaylist[]>('user-playlists', { userId: String(userId) });
}

/**
 * Toutes les playlists publiques du compte SoundCloud du collectif (Hidden Rhythms) —
 * pas de curation manuelle, tout ce qui est publié là-bas apparaît automatiquement.
 */
export async function fetchHiddenRhythmsPlaylists(): Promise<SoundCloudPlaylist[]> {
  const account = await resolveArtistByUrl(HIDDEN_RHYTHMS_ACCOUNT_URL);
  return fetchUserPlaylists(account.id);
}
