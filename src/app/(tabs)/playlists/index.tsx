import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchHiddenRhythmsPlaylists } from '@/api/soundcloud';
import { fetchPlaylists } from '@/api/supabase';
import { ArtistCard } from '@/components/ArtistCard';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, MiniPlayerReservedSpace, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const soundCloudQuery = useQuery({
    queryKey: ['hidden-rhythms-playlists'],
    queryFn: fetchHiddenRhythmsPlaylists,
  });
  const localQuery = useQuery({ queryKey: ['playlists'], queryFn: fetchPlaylists });

  const isLoading = soundCloudQuery.isLoading || localQuery.isLoading;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + BottomTabInset + MiniPlayerReservedSpace + Spacing.three,
        },
      ]}>
      <ThemedText type="subtitle" style={styles.header}>
        Playlists SoundCloud
      </ThemedText>
      {soundCloudQuery.error && (
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          Impossible de charger les playlists SoundCloud.
        </ThemedText>
      )}
      {soundCloudQuery.data?.length === 0 && (
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          Aucune playlist publique sur le compte SoundCloud pour le moment.
        </ThemedText>
      )}
      {soundCloudQuery.data?.map((playlist) => (
        <ArtistCard
          key={`sc-${playlist.id}`}
          name={playlist.title}
          avatarUrl={playlist.artwork_url}
          onPress={() => router.push(`/playlists/sc-${playlist.id}`)}
        />
      ))}

      <ThemedText type="subtitle" style={styles.header}>
        Nos playlists
      </ThemedText>
      {localQuery.error && (
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          Impossible de charger les playlists. Vérifiez la configuration Supabase.
        </ThemedText>
      )}
      {localQuery.data?.length === 0 && (
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          Aucune playlist pour le moment — créez-en une depuis le panel admin.
        </ThemedText>
      )}
      {localQuery.data?.map((playlist) => (
        <ArtistCard
          key={playlist.id}
          name={playlist.name}
          avatarUrl={playlist.cover_url}
          onPress={() => router.push(`/playlists/${playlist.id}`)}
        />
      ))}

      {isLoading && <ActivityIndicator color={theme.accent} style={styles.loader} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  emptyText: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  loader: {
    paddingVertical: Spacing.four,
  },
});
