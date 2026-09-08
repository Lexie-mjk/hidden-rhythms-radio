# Hidden Rhythms Radio

Application mobile (React Native / Expo) du collectif **Hidden Rhythms** : une web radio qui met en avant les sets du collectif et les artistes/playlists de son compte SoundCloud.

## Fonctionnement

L'app a 3 onglets et un panel d'administration caché.

### Radio
Lecture **aléatoire et en continu** du catalogue de sets hébergés sur Cloudflare R2 (uploadés depuis le panel admin). Pas de synchronisation entre auditeurs — chacun a sa propre lecture.

### Playlist
Deux sources, affichées côte à côte :
- **Playlists SoundCloud** — toutes les playlists publiques du compte SoundCloud de Hidden Rhythms, récupérées en direct. Rien à gérer : tout ce qui est publié sur SoundCloud apparaît automatiquement.
- **Nos playlists** — des playlists "maison", composées de sets déjà hébergés sur R2, créées depuis le panel admin.

### Artistes
Les artistes du collectif, chacun avec sa bio et ses morceaux SoundCloud.

### Panel admin (`/admin`)
Route volontairement absente de la barre d'onglets, accessible en tapant l'URL. Protégée par une vraie connexion (Supabase Auth — pas de mot de passe partagé). Permet d'ajouter/supprimer des sets (upload direct de fichiers audio + pochette), des artistes SoundCloud, et des playlists maison.

## Comment c'est construit

Pas de serveur applicatif classique — le backend est **Supabase** (Postgres + Auth) plus **Cloudflare R2** pour les fichiers (audio, pochettes). Deux Edge Functions détiennent les secrets serveur, jamais exposés côté client :
- `soundcloud-proxy` garde le `client_secret` SoundCloud (l'API exige désormais un token OAuth2) et sert de proxy pour les recherches de métadonnées (profils, morceaux, playlists) ; le token est mis en cache en base pour ne pas re-solliciter l'API à chaque appel. La lecture audio SoundCloud, elle, passe par le Widget public officiel — aucun besoin d'auth pour ça.
- `r2-upload-url` signe une URL d'upload de courte durée vers R2 pour le panel admin (réservé aux comptes authentifiés) : le fichier est envoyé directement à R2 depuis l'app, sans jamais transiter par Supabase — indispensable pour des sets de plusieurs dizaines/centaines de Mo. R2 a été choisi plutôt que Supabase Storage pour son égress gratuit (important pour du streaming) et l'absence de limite de taille de fichier restrictive.

Deux moteurs de lecture coexistent derrière une seule interface (`PlayerContext`) : `expo-audio` pour les fichiers hébergés sur R2, et le Widget SoundCloud embarqué (WebView sur mobile, `<iframe>` sur web) pour SoundCloud — un seul son actif à la fois, peu importe la source.

```
src/
  api/          clients Supabase et SoundCloud
  app/          écrans (expo-router) : (tabs)/ pour les 3 onglets, admin.tsx à part
  components/   UI réutilisable
  player/       PlayerContext + lecteur SoundCloud (WebView / iframe)
supabase/
  schema.sql              tables tracks / soundcloud_artists + lecture publique
  admin-access.sql        droits d'écriture pour le compte admin
  playlists.sql           tables playlists / playlist_tracks
  soundcloud-cache.sql    cache du token OAuth SoundCloud
  functions/soundcloud-proxy   Edge Function (proxy API SoundCloud)
  functions/r2-upload-url      Edge Function (URLs d'upload signées vers R2)
```

## Démarrer en local

```bash
npm install
cp .env.example .env   # puis remplir les valeurs (voir .env.example)
npx expo start --web   # ou --ios / --android avec un build de dev (expo-audio est natif)
```

Côté Supabase (une fois) : exécuter `schema.sql`, `admin-access.sql`, `playlists.sql` et `soundcloud-cache.sql` dans l'éditeur SQL, créer un compte admin (Authentication > Users), et déployer les Edge Functions :

```bash
npx supabase login
npx supabase link
npx supabase secrets set SOUNDCLOUD_CLIENT_ID=... SOUNDCLOUD_CLIENT_SECRET=...
npx supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=... R2_PUBLIC_URL_BASE=...
npx supabase functions deploy soundcloud-proxy
npx supabase functions deploy r2-upload-url
```

Côté Cloudflare (une fois) : créer un compte, un bucket R2, un token API R2 (lecture/écriture sur ce bucket), et activer l'accès public (URL `r2.dev` ou domaine personnalisé) pour `R2_PUBLIC_URL_BASE`.

## Charte graphique

Palette dérivée directement du logo du collectif (couronne végétale vert sauge sur fond ivoire).

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F9F0C9` | `#161C10` |
| Fond élément (carte) | `#F0E6B4` | `#212B17` |
| Fond sélectionné | `#E4D89C` | `#2D3A1F` |
| Texte | `#2E3A1E` | `#F3ECC9` |
| Texte secondaire | `#6B7256` | `#9CAE86` |
| Accent (boutons, actif) | `#5C7A46` | `#8CAE72` |
| Texte sur accent | `#F9F0C9` | `#161C10` |

Le thème sombre est l'inverse du clair (fond forêt profond, texte crème) — les deux réutilisent la même famille vert sauge / ivoire du logo, jamais de couleur hors palette (pas de bleu système, pas de rouge — même les indicateurs de chargement sont teintés en vert accent).

- **Typographie** : police système (`system-ui` iOS, par défaut ailleurs), pas de police custom.
- **Espacements** : échelle en puissances de 2 — 2 / 4 / 8 / 16 / 24 / 32 / 64.
- **Formes** : coins arrondis généreux (boutons pilule, cartes à `border-radius` large), cohérent avec la forme circulaire de la couronne du logo.
- **Logo** : [assets/images/hidden-logo.png](assets/images/hidden-logo.png), utilisé comme icône d'app, splash screen, favicon et pochette par défaut. C'est un export basse résolution (96×96) — à refaire en haute résolution (idéalement 1024×1024, fond transparent pour l'icône adaptative Android) avant une soumission sur les stores.

## Roadmap

### À faire avant que tout soit pleinement fonctionnel
- [x] Exécuter `admin-access.sql` et `playlists.sql` dans Supabase.
- [x] Récupérer le `client_secret` SoundCloud et déployer la Edge Function `soundcloud-proxy`.
- [x] Vérifier `EXPO_PUBLIC_SOUNDCLOUD_ACCOUNT_URL` dans `.env` (confirmé par les vraies playlists/artistes Hidden Rhythms qui s'affichent dans l'app).
- [ ] Renommer `EXPO_PUBLIC_SUPABASE_SECRET_KEY` en `SUPABASE_SECRET_KEY` (sans préfixe `EXPO_PUBLIC_`) — cette clé ne doit jamais être embarquée côté client.
- [ ] Créer le compte/bucket/token Cloudflare R2, configurer les secrets `R2_*` et déployer `r2-upload-url` (voir "Démarrer en local").
- [ ] Build de dev (`eas build --profile development`) pour tester sur un vrai téléphone : lecture en arrière-plan, contrôle écran verrouillé, upload de fichiers depuis le panel admin.
- [x] ~~Diagnostiquer l'affichage cassé signalé dans Expo Go~~ — cause trouvée et corrigée : `react-native-webview` n'applique `style` qu'à sa vue interne, jamais à son conteneur externe (`flex: 1` par défaut), atteignable uniquement via `containerStyle`. Le widget SoundCloud "caché" (`SoundCloudWidgetPlayer.tsx`) ne stylait que `style`, donc son conteneur `flex: 1` prenait la moitié de l'écran dès qu'un morceau SoundCloud était joué — l'app se retrouvait compressée en haut, fond blanc en dessous. Voir "Pièges connus" dans `AGENTS.md`. À reconfirmer par un nouveau test dans Expo Go.

### Court terme
- [ ] Logo en haute résolution (icône d'app, splash, icône adaptative Android correctement détourée).
- [ ] Skip morceau précédent/suivant visible dans le mini-lecteur (déjà géré côté code, pas encore de bouton).
- [x] ~~Surveiller la fiabilité de la Edge Function `soundcloud-proxy`~~ — cause trouvée : SoundCloud limite les tokens `client_credentials` à 50/12h par app, et la fonction en redemandait un à chaque redémarrage à froid. Corrigé par un cache persistant en base (`soundcloud_oauth_cache`, voir `supabase/soundcloud-cache.sql`) qui survit aux redémarrages et renouvelle via `refresh_token` plutôt que de redemander un token neuf. **Si l'app affiche encore une erreur juste après ce fix, c'est que le quota des 12h précédentes n'est pas encore reset côté SoundCloud — patienter, pas la peine de re-tester en boucle.**

### Idées pour plus tard
- [ ] Recherche/filtre dans le catalogue de sets.
- [ ] Écran "à propos" du collectif.
- [ ] Notifications pour les nouveaux sets/playlists.
- [ ] Mode hors-ligne (mise en cache des sets déjà écoutés).
