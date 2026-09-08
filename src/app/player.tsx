import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/player/PlayerContext';

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { nowPlaying, queueContext, isPlaying, isBuffering, togglePlayPause, skipNext, skipPrevious, shuffleQueue } =
    usePlayer();

  const showSkipControls = queueContext !== 'radio';
  const showShuffle = queueContext === 'playlist';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.four }]}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
        <SymbolView
          tintColor={theme.text}
          name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
          size={26}
        />
      </Pressable>

      {!nowPlaying ? (
        <View style={styles.empty}>
          <ThemedText themeColor="textSecondary">Rien n’est en cours de lecture.</ThemedText>
        </View>
      ) : (
        <View style={styles.content}>
          {nowPlaying.artworkUrl ? (
            <Image source={{ uri: nowPlaying.artworkUrl }} style={styles.artwork} />
          ) : (
            <ThemedView type="backgroundElement" style={[styles.artwork, styles.artworkPlaceholder]}>
              <Image source={require('@/assets/images/hidden-logo.png')} style={styles.artworkLogo} />
            </ThemedView>
          )}

          <View style={styles.texts}>
            <ThemedText type="subtitle" numberOfLines={2} style={styles.centerText}>
              {nowPlaying.title}
            </ThemedText>
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.centerText}>
              {nowPlaying.artist}
            </ThemedText>
          </View>

          <View style={styles.controls}>
            {showSkipControls && (
              <Pressable onPress={skipPrevious} hitSlop={12}>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'backward.fill', android: 'skip_previous', web: 'skip_previous' }}
                  size={32}
                />
              </Pressable>
            )}

            <Pressable onPress={togglePlayPause} disabled={isBuffering}>
              <ThemedView type="accent" style={styles.playButton}>
                <SymbolView
                  tintColor={theme.onAccent}
                  name={{
                    ios: isPlaying ? 'pause.fill' : 'play.fill',
                    android: isPlaying ? 'pause' : 'play_arrow',
                    web: isPlaying ? 'pause' : 'play_arrow',
                  }}
                  size={34}
                />
              </ThemedView>
            </Pressable>

            {showSkipControls && (
              <Pressable onPress={skipNext} hitSlop={12}>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'forward.fill', android: 'skip_next', web: 'skip_next' }}
                  size={32}
                />
              </Pressable>
            )}
          </View>

          {showShuffle && (
            <Pressable onPress={shuffleQueue} style={styles.shuffleButton} hitSlop={12}>
              <SymbolView
                tintColor={theme.accent}
                name={{ ios: 'shuffle', android: 'shuffle', web: 'shuffle' }}
                size={20}
              />
              <ThemedText type="small" themeColor="accent" style={styles.shuffleLabel}>
                Mélanger
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  closeButton: {
    alignSelf: 'flex-start',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  artwork: {
    width: 280,
    height: 280,
    borderRadius: Spacing.four,
  },
  artworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkLogo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.9,
  },
  texts: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.five,
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  shuffleLabel: {
    fontWeight: '600',
  },
});
