import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchTracks } from '@/api/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TrackListItem } from '@/components/TrackListItem';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlayer } from '@/player/PlayerContext';

export default function SetsScreen() {
  const insets = useSafeAreaInsets();
  const { playLocalQueue } = usePlayer();

  const { data: tracks, isLoading, error } = useQuery({
    queryKey: ['tracks'],
    queryFn: fetchTracks,
  });

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
      ]}
      data={tracks ?? []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <ThemedText type="subtitle" style={styles.header}>
          Sets du collectif
        </ThemedText>
      }
      ListEmptyComponent={
        !isLoading ? (
          <ThemedView style={styles.emptyState}>
            {error ? (
              <ThemedText themeColor="textSecondary">
                Impossible de charger le catalogue. Vérifiez la configuration Supabase.
              </ThemedText>
            ) : (
              <ThemedText themeColor="textSecondary">
                Aucun set pour le moment — ajoutez-en depuis Supabase Studio.
              </ThemedText>
            )}
          </ThemedView>
        ) : null
      }
      ListFooterComponent={isLoading ? <ActivityIndicator style={styles.loader} /> : null}
      renderItem={({ item, index }) => (
        <TrackListItem
          title={item.title}
          subtitle={item.artist_name}
          artworkUrl={item.cover_url}
          onPress={() => playLocalQueue(tracks ?? [], index)}
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
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
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
