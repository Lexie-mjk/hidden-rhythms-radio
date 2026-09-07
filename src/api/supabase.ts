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
