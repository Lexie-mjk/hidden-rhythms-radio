import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/player/PlayerContext';

/**
 * Bandeau flottant monté dans le layout racine (app/_layout.tsx), au-dessus du Stack.
 */
export function MiniPlayer() {
  const { nowPlaying, isPlaying, isBuffering, togglePlayPause } = usePlayer();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  if (!nowPlaying) return null;

  // BottomTabInset ne couvre que la hauteur de la barre elle-même : il faut y ajouter
  // la zone de sécurité basse (barre d'accueil iOS), sinon le bandeau la recouvre.
  const bottom = insets.bottom + BottomTabInset + Spacing.two;

  return (
    <ThemedView type="backgroundElement" style={[styles.container, { bottom }]}>
      {nowPlaying.artworkUrl ? (
        <Image source={{ uri: nowPlaying.artworkUrl }} style={styles.artwork} />
      ) : (
        <ThemedView type="backgroundSelected" style={styles.artwork} />
      )}

      <ThemedView type="backgroundElement" style={styles.texts}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {nowPlaying.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {nowPlaying.artist}
        </ThemedText>
      </ThemedView>

      <Pressable onPress={togglePlayPause} hitSlop={12} disabled={isBuffering}>
        <SymbolView
          tintColor={theme.text}
          name={{
            ios: isPlaying ? 'pause.fill' : 'play.fill',
            android: isPlaying ? 'pause' : 'play_arrow',
            web: isPlaying ? 'pause' : 'play_arrow',
          }}
          size={26}
        />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: Spacing.one,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
