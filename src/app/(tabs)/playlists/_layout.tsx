import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function PlaylistsLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Pas de header : le nom de l'onglet actif suffit déjà à situer cet écran. */}
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: theme.backgroundElement },
          headerTintColor: theme.text,
        }}
      />
    </Stack>
  );
}
