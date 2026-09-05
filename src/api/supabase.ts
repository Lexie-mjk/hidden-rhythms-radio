import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définis (voir .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
