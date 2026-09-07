import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchHiddenRhythmsPlaylists, type SoundCloudTrack } from '@/api/soundcloud';
import { fetchPlaylist, fetchPlaylistTracks, type Track } from '@/api/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TrackListItem } from '@/components/TrackListItem';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/player/PlayerContext';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id?.startsWith('sc-') ? (
    <SoundCloudPlaylistScreen soundCloudId={Number(id.slice(3))} />
  ) : (
    <LocalPlaylistScreen playlistId={id} />
  );
}

function SoundCloudPlaylistScreen({ soundCloudId }: { soundCloudId: number }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { playSoundCloudQueue } = usePlayer();

  const { data: playlists, isLoading, error } = useQuery({
    queryKey: ['hidden-rhythms-playlists'],
    queryFn: fetchHiddenRhythmsPlaylists,
  });
  const playlist = playlists?.find((p) => p.id === soundCloudId);
  const tracks: SoundCloudTrack[] = playlist?.tracks ?? [];

  return (
    <PlaylistTrackList
      title={playlist?.title}
      tracks={tracks}
      isLoading={isLoading}
      hasError={!!error}
      insetsBottom={insets.bottom}
      accentColor={theme.accent}
      renderTrack={(track, index) => (
        <TrackListItem
          title={track.title}
          subtitle="SoundCloud"
          artworkUrl={track.artwork_url}
          onPress={() => playSoundCloudQueue(tracks, index, playlist?.title ?? '')}
        />
      )}
    />
  );
}

function LocalPlaylistScreen({ playlistId }: { playlistId: string }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { playLocalQueue } = usePlayer();

  const playlistQuery = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => fetchPlaylist(playlistId),
  });
  const tracksQuery = useQuery({
    queryKey: ['playlist-tracks', playlistId],
    queryFn: () => fetchPlaylistTracks(playlistId),
  });
  const tracks: Track[] = tracksQuery.data ?? [];

  return (
    <PlaylistTrackList
      title={playlistQuery.data?.name}
      tracks={tracks}
      isLoading={playlistQuery.isLoading || tracksQuery.isLoading}
      hasError={!!playlistQuery.error || !!tracksQuery.error}
      insetsBottom={insets.bottom}
      accentColor={theme.accent}
      renderTrack={(track, index) => (
        <TrackListItem
          title={track.title}
          subtitle={track.artist_name}
          artworkUrl={track.cover_url}
          onPress={() => playLocalQueue(tracks, index)}
        />
      )}
    />
  );
}

function PlaylistTrackList<T>({
  title,
  tracks,
  isLoading,
  hasError,
  insetsBottom,
  accentColor,
  renderTrack,
}: {
  title: string | undefined;
  tracks: T[];
  isLoading: boolean;
  hasError: boolean;
  insetsBottom: number;
  accentColor: string;
  renderTrack: (track: T, index: number) => ReactElement;
}) {
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingBottom: insetsBottom + BottomTabInset + Spacing.three }]}
      data={tracks}
      keyExtractor={(_, index) => String(index)}
      ListHeaderComponent={
        title ? (
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">{title}</ThemedText>
          </ThemedView>
        ) : null
      }
      ListEmptyComponent={
        !isLoading ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText themeColor="textSecondary">
              {hasError ? 'Impossible de charger cette playlist.' : 'Cette playlist est vide pour le moment.'}
            </ThemedText>
          </ThemedView>
        ) : null
      }
      ListFooterComponent={isLoading ? <ActivityIndicator color={accentColor} style={styles.loader} /> : null}
      renderItem={({ item, index }) => renderTrack(item, index)}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  emptyState: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  loader: {
    paddingVertical: Spacing.four,
  },
});
