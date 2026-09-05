import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type Props = {
  title: string;
  subtitle: string;
  artworkUrl: string | null;
  onPress: () => void;
};

export function TrackListItem({ title, subtitle, artworkUrl, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView style={styles.row}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={styles.artwork} />
        ) : (
          <ThemedView type="backgroundElement" style={styles.artwork} />
        )}
        <ThemedView style={styles.texts}>
          <ThemedText type="default" numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: Spacing.one,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
