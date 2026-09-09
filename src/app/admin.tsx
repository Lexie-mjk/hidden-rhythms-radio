import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addTrackToPlaylist,
  deletePlaylist,
  deleteSoundCloudArtist,
  deleteTrack,
  fetchPlaylist,
  fetchPlaylists,
  fetchPlaylistTracks,
  fetchSoundCloudArtists,
  fetchTracks,
  insertPlaylist,
  insertSoundCloudArtist,
  insertTrack,
  removeTrackFromPlaylist,
  signInAdmin,
  signOutAdmin,
  supabase,
  updatePlaylist,
  uploadToR2,
  type Playlist,
  type Track,
} from '@/api/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + Spacing.six }]}>
      <View style={styles.content}>
        {session === undefined ? (
          <ActivityIndicator style={styles.centerLoader} />
        ) : session === null ? (
          <LoginForm />
        ) : (
          <AdminPanel session={session} />
        )}
      </View>
    </ScrollView>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInAdmin(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="subtitle">Connexion admin</ThemedText>
      <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <FormField label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      {error && (
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      )}
      <SubmitButton label="Se connecter" onPress={handleSubmit} disabled={isSubmitting || !email || !password} />
    </ThemedView>
  );
}

const ADMIN_TABS = ['sets', 'playlists', 'artists'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];
const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  sets: 'Sets',
  playlists: 'Playlists',
  artists: 'Artistes',
};

function AdminPanel({ session }: { session: Session }) {
  const [tab, setTab] = useState<AdminTab>('sets');

  return (
    <>
      <ThemedView style={[styles.section, styles.row]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex1}>
          Connecté en tant que {session.user.email}
        </ThemedText>
        <Pressable onPress={() => signOutAdmin()}>
          <ThemedText type="link">Se déconnecter</ThemedText>
        </Pressable>
      </ThemedView>

      <TabSwitcher value={tab} onChange={setTab} />

      {tab === 'sets' && <TracksAdmin />}
      {tab === 'playlists' && <PlaylistsAdmin />}
      {tab === 'artists' && <SoundCloudArtistsAdmin />}
    </>
  );
}

function TabSwitcher({ value, onChange }: { value: AdminTab; onChange: (tab: AdminTab) => void }) {
  return (
    <View style={styles.tabSwitcher}>
      {ADMIN_TABS.map((tabKey) => (
        <Pressable key={tabKey} style={styles.flex1} onPress={() => onChange(tabKey)}>
          <ThemedView
            type={value === tabKey ? 'accent' : 'backgroundElement'}
            style={styles.tabButton}>
            <ThemedText
              type="smallBold"
              themeColor={value === tabKey ? 'onAccent' : 'textSecondary'}
              style={styles.centerText}>
              {ADMIN_TAB_LABELS[tabKey]}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </View>
  );
}

// react-native-web n'implémente pas Alert.alert (no-op) : les boutons et leur onPress
// n'existent pas côté navigateur. On bascule sur window.confirm sur web.
function confirmDelete(label: string, onConfirm: () => void) {
  const message = `Supprimer « ${label} » ? Cette action est irréversible.`;
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Supprimer ?', message, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: onConfirm },
  ]);
}

/** Upload un fichier local vers R2 sous folder/, renvoie son URL publique et son nom d'origine. */
async function pickAndUploadFile(
  folder: string,
  type: string,
  onProgress?: (fraction: number) => void
): Promise<{ url: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const blob = await (await fetch(asset.uri)).blob();
  const extension = asset.name.includes('.') ? asset.name.split('.').pop() : undefined;
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension}` : ''}`;
  const url = await uploadToR2(path, blob, asset.mimeType ?? undefined, onProgress);
  return { url, name: asset.name };
}

function TracksAdmin() {
  const queryClient = useQueryClient();
  const { data: tracks } = useQuery({ queryKey: ['tracks'], queryFn: fetchTracks });

  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<'audio' | 'cover' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const addMutation = useMutation({
    mutationFn: insertTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setTitle('');
      setArtistName('');
      setAudioFileName(null);
      setAudioUrl(null);
      setCoverFileName(null);
      setCoverUrl(null);
    },
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTrack,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tracks'] }),
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  async function handlePickAudio() {
    setUploadTarget('audio');
    setUploadProgress(0);
    try {
      const result = await pickAndUploadFile('audio', 'audio/*', setUploadProgress);
      if (!result) return;
      setAudioUrl(result.url);
      setAudioFileName(result.name);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setUploadTarget(null);
    }
  }

  async function handlePickCover() {
    setUploadTarget('cover');
    setUploadProgress(0);
    try {
      const result = await pickAndUploadFile('covers', 'image/*', setUploadProgress);
      if (!result) return;
      setCoverUrl(result.url);
      setCoverFileName(result.name);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setUploadTarget(null);
    }
  }

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="subtitle">Ajouter un set</ThemedText>
      <FormField label="Titre" value={title} onChangeText={setTitle} />
      <FormField label="Artiste" value={artistName} onChangeText={setArtistName} />
      <FilePickerField
        label="Fichier audio"
        fileName={audioFileName}
        isUploading={uploadTarget === 'audio'}
        progress={uploadProgress}
        onPress={handlePickAudio}
      />
      <FilePickerField
        label="Pochette (optionnel)"
        fileName={coverFileName}
        isUploading={uploadTarget === 'cover'}
        progress={uploadProgress}
        onPress={handlePickCover}
      />
      <SubmitButton
        label="Ajouter le set"
        disabled={addMutation.isPending || !title || !artistName || !audioUrl}
        onPress={() =>
          addMutation.mutate({
            title: title.trim(),
            artist_name: artistName.trim(),
            audio_url: audioUrl as string,
            cover_url: coverUrl ?? undefined,
          })
        }
      />

      <ThemedText type="smallBold" style={styles.formTitle}>
        Sets existants ({tracks?.length ?? 0})
      </ThemedText>
      {tracks?.map((track) => (
        <View key={track.id} style={styles.listRow}>
          <ThemedText style={styles.flex1} numberOfLines={1}>
            {track.title} — {track.artist_name}
          </ThemedText>
          <Pressable onPress={() => confirmDelete(track.title, () => deleteMutation.mutate(track.id))}>
            <DeleteIcon />
          </Pressable>
        </View>
      ))}
      {tracks?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Aucun set pour le moment.
        </ThemedText>
      )}
    </ThemedView>
  );
}

function PlaylistsAdmin() {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  if (selectedPlaylistId) {
    return (
      <PlaylistEditor playlistId={selectedPlaylistId} onBack={() => setSelectedPlaylistId(null)} />
    );
  }
  return <PlaylistsList onSelect={setSelectedPlaylistId} />;
}

function PlaylistsList({ onSelect }: { onSelect: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { data: playlists } = useQuery({ queryKey: ['playlists'], queryFn: fetchPlaylists });

  const [name, setName] = useState('');
  const [coverFileName, setCoverFileName] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const addMutation = useMutation({
    mutationFn: insertPlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      setName('');
      setCoverFileName(null);
      setCoverUrl(null);
    },
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  async function handlePickCover() {
    setIsUploadingCover(true);
    setUploadProgress(0);
    try {
      const result = await pickAndUploadFile('playlist-covers', 'image/*', setUploadProgress);
      if (!result) return;
      setCoverUrl(result.url);
      setCoverFileName(result.name);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploadingCover(false);
    }
  }

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="subtitle">Créer une playlist</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Playlists composées de sets déjà hébergés dans l’onglet Sets. Les playlists SoundCloud de
        Hidden Rhythms, elles, apparaissent automatiquement dans l’app — rien à faire ici.
      </ThemedText>
      <FormField label="Nom" value={name} onChangeText={setName} />
      <FilePickerField
        label="Pochette (optionnel)"
        fileName={coverFileName}
        isUploading={isUploadingCover}
        progress={uploadProgress}
        onPress={handlePickCover}
      />
      <SubmitButton
        label="Créer la playlist"
        disabled={addMutation.isPending || !name}
        onPress={() => addMutation.mutate({ name: name.trim(), cover_url: coverUrl ?? undefined })}
      />

      <ThemedText type="smallBold" style={styles.formTitle}>
        Nos playlists ({playlists?.length ?? 0})
      </ThemedText>
      {playlists?.map((playlist) => (
        <PlaylistCard key={playlist.id} playlist={playlist} onPress={() => onSelect(playlist.id)} />
      ))}
      {playlists?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Aucune playlist pour le moment.
        </ThemedText>
      )}
    </ThemedView>
  );
}

function PlaylistCard({ playlist, onPress }: { playlist: Playlist; onPress: () => void }) {
  const theme = useTheme();
  const { data: tracks } = useQuery({
    queryKey: ['playlist-tracks', playlist.id],
    queryFn: () => fetchPlaylistTracks(playlist.id),
  });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <View style={styles.playlistCard}>
        {playlist.cover_url ? (
          <Image source={{ uri: playlist.cover_url }} style={styles.playlistCover} />
        ) : (
          <ThemedView type="backgroundSelected" style={styles.playlistCover} />
        )}
        <View style={styles.flex1}>
          <ThemedText numberOfLines={1}>{playlist.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {tracks ? `${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}` : '…'}
          </ThemedText>
        </View>
        <SymbolView
          tintColor={theme.textSecondary}
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={18}
        />
      </View>
    </Pressable>
  );
}

function PlaylistEditor({ playlistId, onBack }: { playlistId: string; onBack: () => void }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data: playlist } = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => fetchPlaylist(playlistId),
  });
  const { data: allTracks } = useQuery({ queryKey: ['tracks'], queryFn: fetchTracks });

  const [name, setName] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Pré-remplit le formulaire une fois la playlist chargée (pattern recommandé par la doc
  // expo-audio pour ce genre d'ajustement d'état : conditionné, il ne s'exécute qu'une fois).
  const [initialized, setInitialized] = useState(false);
  if (playlist && !initialized) {
    setName(playlist.name);
    setCoverUrl(playlist.cover_url);
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: (changes: { name?: string; cover_url?: string }) => updatePlaylist(playlistId, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlaylist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      onBack();
    },
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  async function handlePickCover() {
    setIsUploadingCover(true);
    setUploadProgress(0);
    try {
      const result = await pickAndUploadFile('playlist-covers', 'image/*', setUploadProgress);
      if (!result) return;
      setCoverUrl(result.url);
      setCoverFileName(result.name);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploadingCover(false);
    }
  }

  return (
    <ThemedView style={styles.section}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <SymbolView
          tintColor={theme.accent}
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          size={16}
        />
        <ThemedText type="link">Retour aux playlists</ThemedText>
      </Pressable>

      <FormField label="Nom" value={name} onChangeText={setName} />
      <FilePickerField
        label="Pochette"
        fileName={coverFileName ?? (coverUrl ? 'Pochette actuelle conservée' : null)}
        isUploading={isUploadingCover}
        progress={uploadProgress}
        onPress={handlePickCover}
      />
      <SubmitButton
        label="Enregistrer"
        disabled={updateMutation.isPending || !name}
        onPress={() => updateMutation.mutate({ name: name.trim(), cover_url: coverUrl ?? undefined })}
      />

      <ThemedText type="smallBold" style={styles.formTitle}>
        Morceaux de la playlist
      </ThemedText>
      <PlaylistTrackPicker playlistId={playlistId} allTracks={allTracks ?? []} />

      <Pressable
        onPress={() =>
          confirmDelete(playlist?.name ?? 'cette playlist', () => deleteMutation.mutate(playlistId))
        }>
        <ThemedText type="small" themeColor="textSecondary" style={styles.deletePlaylistText}>
          Supprimer cette playlist
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function PlaylistTrackPicker({ playlistId, allTracks }: { playlistId: string; allTracks: Track[] }) {
  const queryClient = useQueryClient();
  const { data: playlistTracks } = useQuery({
    queryKey: ['playlist-tracks', playlistId],
    queryFn: () => fetchPlaylistTracks(playlistId),
  });
  const memberIds = new Set((playlistTracks ?? []).map((t) => t.id));

  const toggleMutation = useMutation({
    mutationFn: async (track: Track) => {
      if (memberIds.has(track.id)) {
        await removeTrackFromPlaylist(playlistId, track.id);
      } else {
        await addTrackToPlaylist(playlistId, track.id, memberIds.size);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlist-tracks', playlistId] }),
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  return (
    <View>
      {allTracks.map((track) => {
        const isMember = memberIds.has(track.id);
        return (
          <Pressable
            key={track.id}
            style={styles.listRow}
            onPress={() => toggleMutation.mutate(track)}
            disabled={toggleMutation.isPending}>
            <CheckIcon checked={isMember} />
            <ThemedText style={styles.flex1} numberOfLines={1}>
              {track.title}
            </ThemedText>
          </Pressable>
        );
      })}
      {allTracks.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Ajoutez d’abord des sets dans l’onglet Sets.
        </ThemedText>
      )}
    </View>
  );
}

function SoundCloudArtistsAdmin() {
  const queryClient = useQueryClient();
  const { data: artists } = useQuery({ queryKey: ['soundcloud-artists'], queryFn: fetchSoundCloudArtists });

  const [permalinkUrl, setPermalinkUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  const addMutation = useMutation({
    mutationFn: insertSoundCloudArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soundcloud-artists'] });
      setPermalinkUrl('');
      setDisplayName('');
      setBio('');
    },
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSoundCloudArtist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['soundcloud-artists'] }),
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="subtitle">Ajouter un artiste</ThemedText>
      <FormField
        label="URL SoundCloud (ex: https://soundcloud.com/nom-artiste)"
        value={permalinkUrl}
        onChangeText={setPermalinkUrl}
        autoCapitalize="none"
      />
      <FormField label="Nom affiché" value={displayName} onChangeText={setDisplayName} />
      <FormField label="Bio (optionnel)" value={bio} onChangeText={setBio} multiline />
      <SubmitButton
        label="Ajouter l'artiste"
        disabled={addMutation.isPending || !permalinkUrl || !displayName}
        onPress={() =>
          addMutation.mutate({
            soundcloud_permalink_url: permalinkUrl.trim(),
            display_name: displayName.trim(),
            bio: bio.trim() || undefined,
          })
        }
      />

      <ThemedText type="smallBold" style={styles.formTitle}>
        Artistes existants ({artists?.length ?? 0})
      </ThemedText>
      {artists?.map((artist) => (
        <View key={artist.id} style={styles.listRow}>
          <ThemedText style={styles.flex1} numberOfLines={1}>
            {artist.display_name}
          </ThemedText>
          <Pressable
            onPress={() => confirmDelete(artist.display_name, () => deleteMutation.mutate(artist.id))}>
            <DeleteIcon />
          </Pressable>
        </View>
      ))}
      {artists?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Aucun artiste pour le moment.
        </ThemedText>
      )}
    </ThemedView>
  );
}

function FormField(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {props.label}
      </ThemedText>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundSelected },
          props.multiline && styles.inputMultiline,
        ]}
      />
    </View>
  );
}

function FilePickerField({
  label,
  fileName,
  isUploading,
  progress,
  onPress,
}: {
  label: string;
  fileName: string | null;
  isUploading: boolean;
  progress?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable onPress={onPress} disabled={isUploading}>
        <View style={[styles.input, styles.filePickerButton, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" numberOfLines={1} style={styles.flex1}>
            {isUploading
              ? `Envoi en cours… ${Math.round((progress ?? 0) * 100)}%`
              : (fileName ?? 'Choisir un fichier…')}
          </ThemedText>
          {isUploading && <ActivityIndicator size="small" color={theme.accent} />}
        </View>
      </Pressable>
      {isUploading && (
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.accent, width: `${Math.round((progress ?? 0) * 100)}%` },
            ]}
          />
        </View>
      )}
    </View>
  );
}

function SubmitButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={disabled && styles.disabled}>
      <ThemedView type="accent" style={styles.submitButton}>
        <ThemedText themeColor="onAccent" type="smallBold">
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function DeleteIcon() {
  const theme = useTheme();
  return (
    <SymbolView
      tintColor={theme.textSecondary}
      name={{ ios: 'trash', android: 'delete', web: 'delete' }}
      size={18}
    />
  );
}

function CheckIcon({ checked }: { checked: boolean }) {
  const theme = useTheme();
  return (
    <SymbolView
      tintColor={checked ? theme.accent : theme.textSecondary}
      name={{
        ios: checked ? 'checkmark.circle.fill' : 'circle',
        android: checked ? 'check_circle' : 'radio_button_unchecked',
        web: checked ? 'check_circle' : 'radio_button_unchecked',
      }}
      size={18}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  centerLoader: {
    marginTop: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  section: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  tabButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  playlistCover: {
    width: 44,
    height: 44,
    borderRadius: Spacing.one,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingBottom: Spacing.one,
  },
  deletePlaylistText: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  formTitle: {
    marginTop: Spacing.two,
  },
  field: {
    gap: Spacing.half,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  submitButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    marginTop: Spacing.one,
  },
  disabled: {
    opacity: 0.5,
  },
});
