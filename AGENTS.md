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
- **`@aws-sdk/client-s3` vers Cloudflare R2 : désactiver le checksum automatique.**
  Depuis les versions récentes, `S3Client` ajoute par défaut un checksum CRC32
  (`x-amz-checksum-*`) aux requêtes `PutObject`/upload, y compris dans les URLs
  pré-signées. R2 ne supporte pas ce checksum et rejette la requête d'une façon que
  le navigateur rapporte comme un blocage CORS (message trompeur — le vrai problème
  n'a rien à voir avec la politique CORS du bucket). Fix : `new S3Client({ ...,
  requestChecksumCalculation: 'WHEN_REQUIRED' })`. Vu sur
  `supabase/functions/r2-upload-url/index.ts`.
- **`expo-audio` : appeler `setAudioModeAsync` explicitement, sinon le bouton silencieux
  coupe le son.** Sans ça, iOS garde la catégorie de session par défaut : le son est coupé
  sur le haut-parleur quand le téléphone est en mode silencieux, mais pas sur un accessoire
  Bluetooth déjà connecté — d'où l'illusion que "ça ne marche qu'au casque". Fix :
  `setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true,
  interruptionMode: 'doNotMix' })` une fois au montage (`PlayerContext.tsx`).
