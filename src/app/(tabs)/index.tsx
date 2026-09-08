import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchTracks } from '@/api/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, MiniPlayerReservedSpace, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/player/PlayerContext';
import { shuffle } from '@/utils/shuffle';

export default function RadioScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { sourceType, nowPlaying, isPlaying, playLocalQueue, togglePlayPause } = usePlayer();

  const { data: tracks, isLoading, error } = useQuery({
    queryKey: ['tracks'],
    queryFn: fetchTracks,
  });

  const isRadioActive = sourceType === 'local';

  function handleMainButtonPress() {
    if (isRadioActive) {
      togglePlayPause();
      return;
    }
    if (tracks && tracks.length > 0) {
      // Lecture aléatoire en boucle (pas de synchronisation entre auditeurs) : on mélange une
      // fois au lancement, playLocalQueue reste par ailleurs un moteur à ordre fixe (réutilisé
      // tel quel par les playlists, où l'ordre doit être respecté).
      playLocalQueue(shuffle(tracks), 0, 'radio');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.five,
          paddingBottom: insets.bottom + BottomTabInset + MiniPlayerReservedSpace + Spacing.three,
        },
      ]}>
      <ThemedView style={styles.hero}>
        <Image source={require('@/assets/images/hidden-logo.png')} style={styles.brandLogo} />
        <ThemedText type="subtitle" style={styles.title}>
          Radio du collectif
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Tous nos morceaux, en aléatoire et en continu.
        </ThemedText>

        {isRadioActive && nowPlaying?.artworkUrl ? (
          <Image source={{ uri: nowPlaying.artworkUrl }} style={styles.artwork} />
        ) : (
          <ThemedView type="backgroundElement" style={[styles.artwork, styles.artworkPlaceholder]}>
            <Image source={require('@/assets/images/hidden-logo.png')} style={styles.artworkLogo} />
          </ThemedView>
        )}

        {isRadioActive && nowPlaying && (
          <ThemedView style={styles.nowPlayingTexts}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {nowPlaying.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {nowPlaying.artist}
            </ThemedText>
          </ThemedView>
        )}

        <Pressable onPress={handleMainButtonPress} disabled={isLoading || (tracks?.length ?? 0) === 0}>
          <ThemedView type="accent" style={styles.playButton}>
            <SymbolView
              tintColor={theme.onAccent}
              name={{
                ios: isRadioActive && isPlaying ? 'pause.fill' : 'play.fill',
                android: isRadioActive && isPlaying ? 'pause' : 'play_arrow',
                web: isRadioActive && isPlaying ? 'pause' : 'play_arrow',
              }}
              size={32}
            />
          </ThemedView>
        </Pressable>

        {isLoading && <ActivityIndicator color={theme.accent} />}
        {error && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Impossible de charger le catalogue. Vérifiez la configuration Supabase.
          </ThemedText>
        )}
        {!isLoading && !error && (tracks?.length ?? 0) === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Aucun morceau pour le moment — ajoutez-en depuis Supabase Studio.
          </ThemedText>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  brandLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  title: {
    textAlign: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  artwork: {
    width: 220,
    height: 220,
    borderRadius: Spacing.three,
    marginTop: Spacing.four,
  },
  artworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkLogo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.9,
  },
  nowPlayingTexts: {
    alignItems: 'center',
    gap: 2,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
});
