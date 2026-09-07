import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définis (voir .env.example).'
  );
}

// Toujours la clé anon/publishable (protégée par RLS) : jamais la clé secrète côté client,
// qui contournerait RLS et serait embarquée dans le bundle livré à tous les utilisateurs.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // localStorage n'existe pas sur natif ; AsyncStorage n'est pas nécessaire sur web (localStorage suffit).
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type Track = {
  id: string;
  title: string;
  artist_name: string;
  audio_url: string;
  cover_url: string | null;
  duration_seconds: number | null;
  tags: string[] | null;
  created_at: string;
};

export type SoundCloudArtist = {
  id: string;
  soundcloud_permalink_url: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
};

export async function fetchTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchSoundCloudArtists(): Promise<SoundCloudArtist[]> {
  const { data, error } = await supabase
    .from('soundcloud_artists')
    .select('*')
    .order('display_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchSoundCloudArtist(id: string): Promise<SoundCloudArtist> {
  const { data, error } = await supabase
    .from('soundcloud_artists')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// --- Playlists "maison" (morceaux Supabase groupés), distinctes des playlists SoundCloud
// qui sont récupérées en direct depuis l'API et ne sont jamais stockées ici. ---

export type Playlist = {
  id: string;
  name: string;
  cover_url: string | null;
  created_at: string;
};

export async function fetchPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchPlaylist(id: string): Promise<Playlist> {
  const { data, error } = await supabase.from('playlists').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
  const { data, error } = await supabase
    .from('playlist_tracks')
    .select('position, tracks(*)')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => row.tracks as unknown as Track);
}

// --- Admin : authentification et écriture (nécessite un compte Supabase Auth, voir supabase/admin-access.sql) ---

export async function signInAdmin(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export type NewTrack = {
  title: string;
  artist_name: string;
  audio_url: string;
  cover_url?: string;
  tags?: string[];
};

export async function insertTrack(track: NewTrack): Promise<void> {
  const { error } = await supabase.from('tracks').insert(track);
  if (error) throw error;
}

export async function deleteTrack(id: string): Promise<void> {
  const { error } = await supabase.from('tracks').delete().eq('id', id);
  if (error) throw error;
}

export type NewSoundCloudArtist = {
  soundcloud_permalink_url: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
};

export async function insertSoundCloudArtist(artist: NewSoundCloudArtist): Promise<void> {
  const { error } = await supabase.from('soundcloud_artists').insert(artist);
  if (error) throw error;
}

export async function deleteSoundCloudArtist(id: string): Promise<void> {
  const { error } = await supabase.from('soundcloud_artists').delete().eq('id', id);
  if (error) throw error;
}

export type NewPlaylist = {
  name: string;
  cover_url?: string;
};

export async function insertPlaylist(playlist: NewPlaylist): Promise<Playlist> {
  const { data, error } = await supabase.from('playlists').insert(playlist).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlaylist(id: string): Promise<void> {
  const { error } = await supabase.from('playlists').delete().eq('id', id);
  if (error) throw error;
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
  position = 0
): Promise<void> {
  const { error } = await supabase
    .from('playlist_tracks')
    .insert({ playlist_id: playlistId, track_id: trackId, position });
  if (error) throw error;
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const { error } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('track_id', trackId);
  if (error) throw error;
}

/** Upload un fichier (audio ou pochette) vers le bucket public "tracks" et renvoie son URL publique. */
export async function uploadToTracksBucket(
  path: string,
  file: Blob,
  contentType?: string
): Promise<string> {
  const { error } = await supabase.storage.from('tracks').upload(path, file, { contentType });
  if (error) throw error;
  return supabase.storage.from('tracks').getPublicUrl(path).data.publicUrl;
}
