import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchSoundCloudArtists } from '@/api/supabase';
import { ArtistCard } from '@/components/ArtistCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function ArtistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: artists, isLoading, error } = useQuery({
    queryKey: ['soundcloud-artists'],
    queryFn: fetchSoundCloudArtists,
  });

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
      ]}
      data={artists ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !isLoading ? (
          <ThemedView style={styles.emptyState}>
            {error ? (
              <ThemedText themeColor="textSecondary">
                Impossible de charger les artistes. Vérifiez la configuration Supabase.
              </ThemedText>
            ) : (
              <ThemedText themeColor="textSecondary">
                Aucun artiste pour le moment — ajoutez-en depuis Supabase Studio.
              </ThemedText>
            )}
          </ThemedView>
        ) : null
      }
      ListFooterComponent={isLoading ? <ActivityIndicator style={styles.loader} /> : null}
      renderItem={({ item }) => (
        <ArtistCard
          name={item.display_name}
          avatarUrl={item.avatar_url}
          onPress={() => router.push(`/artists/${item.id}`)}
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
  emptyState: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  loader: {
    paddingVertical: Spacing.four,
  },
});
