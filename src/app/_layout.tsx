import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { MiniPlayer } from '@/components/MiniPlayer';
import { Colors } from '@/constants/theme';
import { PlayerProvider } from '@/player/PlayerContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PlayerProvider>
          <AnimatedSplashOverlay />
          {/* Conteneur flex:1 explicite : le Stack le remplit, et le MiniPlayer
              (position absolue) se superpose sans consommer de hauteur. Monté ici
              plutôt que dans (tabs)/_layout.tsx pour rester affiché sur /admin. */}
          <View style={styles.root}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              {/* Route volontairement absente de la barre d'onglets : accessible uniquement via /admin. */}
              <Stack.Screen
                name="admin"
                options={{
                  headerShown: true,
                  title: 'Administration',
                  headerStyle: { backgroundColor: theme.backgroundElement },
                  headerTintColor: theme.text,
                }}
              />
            </Stack>
            <MiniPlayer />
          </View>
        </PlayerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
