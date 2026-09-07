import { Stack } from 'expo-router';

export default function PlaylistsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Playlist' }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
