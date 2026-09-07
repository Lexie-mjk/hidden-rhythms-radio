import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchArtistTracks, resolveArtistByUrl } from '@/api/soundcloud';
import { fetchSoundCloudArtist } from '@/api/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TrackListItem } from '@/components/TrackListItem';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/player/PlayerContext';

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { playSoundCloudQueue } = usePlayer();

  const artistQuery = useQuery({
    queryKey: ['soundcloud-artist', id],
    queryFn: () => fetchSoundCloudArtist(id),
    enabled: !!id,
  });

  const scUserQuery = useQuery({
    queryKey: ['soundcloud-user', artistQuery.data?.soundcloud_permalink_url],
    queryFn: () => resolveArtistByUrl(artistQuery.data!.soundcloud_permalink_url),
    enabled: !!artistQuery.data,
  });

  const tracksQuery = useQuery({
    queryKey: ['soundcloud-tracks', scUserQuery.data?.id],
    queryFn: () => fetchArtistTracks(scUserQuery.data!.id),
    enabled: !!scUserQuery.data,
  });

  const isLoading = artistQuery.isLoading || scUserQuery.isLoading || tracksQuery.isLoading;
  const hasError = artistQuery.error || scUserQuery.error || tracksQuery.error;
  const artistName = artistQuery.data?.display_name ?? '';
  const bio = artistQuery.data?.bio ?? scUserQuery.data?.description;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
      ]}
      data={tracksQuery.data ?? []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">{artistName}</ThemedText>
          {bio ? (
            <ThemedText themeColor="textSecondary" style={styles.bio}>
              {bio}
            </ThemedText>
          ) : null}
        </ThemedView>
      }
      ListEmptyComponent={
        !isLoading ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText themeColor="textSecondary">
              {hasError
                ? "Impossible de charger les morceaux SoundCloud de cet artiste."
                : 'Aucun morceau public trouvé sur SoundCloud pour cet artiste.'}
            </ThemedText>
          </ThemedView>
        ) : null
      }
      ListFooterComponent={isLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}
      renderItem={({ item, index }) => (
        <TrackListItem
          title={item.title}
          subtitle="SoundCloud"
          artworkUrl={item.artwork_url}
          onPress={() => playSoundCloudQueue(tracksQuery.data ?? [], index, artistName)}
        />
      )}
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  bio: {
    lineHeight: 20,
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
