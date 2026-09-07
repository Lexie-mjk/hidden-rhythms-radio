import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';

// En dessous de cette largeur, la barre d'onglets passe en mode compact (voir CustomTabList).
const COMPACT_BREAKPOINT = 480;

export default function AppTabs() {
  return (
    <Tabs style={styles.tabs}>
      {/* TabList avant TabSlot, tous deux en flux normal (pas de position absolue) : la barre
          occupe sa propre hauteur et le contenu (flex:1) se cale juste en dessous, sans jamais
          se superposer — cf. la doc expo-router/ui sur les tab bars personnalisées. */}
      <TabList asChild>
        <CustomTabList>
          {/* "/" est bien le chemin réel de l'écran (tabs)/index — expo-router n'inclut
              pas ce raccourci dans les types générés pour un groupe, d'où le cast. */}
          <TabTrigger name="home" href={'/' as Href} asChild>
            <TabButton>Radio</TabButton>
          </TabTrigger>
          <TabTrigger name="playlists" href="/playlists" asChild>
            <TabButton>Playlist</TabButton>
          </TabTrigger>
          <TabTrigger name="artists" href="/artists" asChild>
            <TabButton>Artistes</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={isFocused ? 'accent' : 'backgroundElement'} style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'onAccent' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView
        type="backgroundElement"
        style={[styles.innerContainer, isCompact && styles.innerContainerCompact]}>
        <Image source={require('@/assets/images/hidden-logo.png')} style={styles.brandLogo} />
        {!isCompact && (
          <ThemedText type="smallBold" style={styles.brandText}>
            Radio Collectif
          </ThemedText>
        )}

        <View style={[styles.triggers, isCompact && styles.triggersCompact]}>{props.children}</View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
    flexDirection: 'column',
  },
  slot: {
    flex: 1,
  },
  tabListContainer: {
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  innerContainerCompact: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  brandText: {
    marginRight: 'auto',
  },
  triggers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
  triggersCompact: {
    gap: Spacing.half,
    marginLeft: 0,
    flex: 1,
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
