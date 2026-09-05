import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PlayerProvider } from '@/player/PlayerContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PlayerProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
          <MiniPlayer />
        </PlayerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
