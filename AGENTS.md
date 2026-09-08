# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Pièges connus

- **`react-native-webview` : toujours styler `containerStyle`, pas seulement `style`.**
  La prop `style` ne s'applique qu'à la vue native interne ; le composant enveloppe
  toujours celle-ci dans un `<View style={{ flex: 1 }}>` qu'on n'atteint que via
  `containerStyle`. Un WebView « caché » avec le seul `style={{ position: 'absolute',
  width: 1, height: 1, opacity: 0 }}` laisse donc un conteneur `flex: 1` dans le flux :
  il prend la moitié de la hauteur de son parent, l'app est comprimée sur la moitié
  haute de l'écran et le bas devient blanc. Vu sur `src/player/SoundCloudWidgetPlayer.tsx`.
- `<NativeTabs>` (`expo-router/unstable-native-tabs`) : la doc ne prévoit que
  `NativeTabs.Trigger` et `NativeTabs.BottomAccessory` comme enfants. Les surcouches
  persistantes (mini-lecteur) sont montées dans `src/app/_layout.tsx`, dans un
  `<View style={{ flex: 1 }}>` qui enveloppe le `<Stack>`.
- `BottomTabInset` ne couvre que la hauteur de la barre d'onglets : toujours y ajouter
  `useSafeAreaInsets().bottom` pour positionner quelque chose au-dessus d'elle.
