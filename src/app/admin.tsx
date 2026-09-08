import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  uploadToR2,
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

function AdminPanel({ session }: { session: Session }) {
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

      <TracksAdmin />
      <PlaylistsAdmin />
      <SoundCloudArtistsAdmin />
    </>
  );
}

/** Upload un fichier local vers R2 sous folder/, renvoie son URL publique. */
async function pickAndUploadFile(folder: string, type: string): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const blob = await (await fetch(asset.uri)).blob();
  const extension = asset.name.includes('.') ? asset.name.split('.').pop() : undefined;
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension}` : ''}`;
  return uploadToR2(path, blob, asset.mimeType ?? undefined);
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
  const [isUploading, setIsUploading] = useState<'audio' | 'cover' | null>(null);

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
    setIsUploading('audio');
    try {
      const url = await pickAndUploadFile('audio', 'audio/*');
      if (!url) return;
      setAudioUrl(url);
      setAudioFileName('fichier sélectionné');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(null);
    }
  }

  async function handlePickCover() {
    setIsUploading('cover');
    try {
      const url = await pickAndUploadFile('covers', 'image/*');
      if (!url) return;
      setCoverUrl(url);
      setCoverFileName('pochette sélectionnée');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(null);
    }
  }

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="subtitle">Sets du collectif (Radio)</ThemedText>

      {tracks?.map((track) => (
        <View key={track.id} style={styles.listRow}>
          <ThemedText style={styles.flex1} numberOfLines={1}>
            {track.title} — {track.artist_name}
          </ThemedText>
          <Pressable onPress={() => deleteMutation.mutate(track.id)}>
            <DeleteIcon />
          </Pressable>
        </View>
      ))}

      <ThemedText type="smallBold" style={styles.formTitle}>
        Ajouter un set
      </ThemedText>
      <FormField label="Titre" value={title} onChangeText={setTitle} />
      <FormField label="Artiste" value={artistName} onChangeText={setArtistName} />
      <FilePickerField
        label="Fichier audio"
        fileName={audioFileName}
        isUploading={isUploading === 'audio'}
        onPress={handlePickAudio}
      />
      <FilePickerField
        label="Pochette (optionnel)"
        fileName={coverFileName}
        isUploading={isUploading === 'cover'}
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
    </ThemedView>
  );
}

function PlaylistsAdmin() {
  const queryClient = useQueryClient();
  const { data: playlists } = useQuery({ queryKey: ['playlists'], queryFn: fetchPlaylists });
  const { data: tracks } = useQuery({ queryKey: ['tracks'], queryFn: fetchTracks });

  const [name, setName] = useState('');
  const [coverFileName, setCoverFileName] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: deletePlaylist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlists'] }),
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  async function handlePickCover() {
    setIsUploadingCover(true);
    try {
      const url = await pickAndUploadFile('playlist-covers', 'image/*');
      if (!url) return;
      setCoverUrl(url);
      setCoverFileName('pochette sélectionnée');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploadingCover(false);
    }
  }

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="subtitle">Nos playlists</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Playlists composées de sets déjà hébergés ci-dessus. Les playlists SoundCloud de Hidden
        Rhythms, elles, apparaissent automatiquement dans l’app — rien à faire ici.
      </ThemedText>

      {playlists?.map((playlist) => (
        <View key={playlist.id}>
          <View style={styles.listRow}>
            <Pressable
              style={styles.flex1}
              onPress={() => setExpandedPlaylistId(expandedPlaylistId === playlist.id ? null : playlist.id)}>
              <ThemedText numberOfLines={1}>{playlist.name}</ThemedText>
            </Pressable>
            <Pressable onPress={() => deleteMutation.mutate(playlist.id)}>
              <DeleteIcon />
            </Pressable>
          </View>
          {expandedPlaylistId === playlist.id && (
            <PlaylistTrackPicker playlistId={playlist.id} allTracks={tracks ?? []} />
          )}
        </View>
      ))}

      <ThemedText type="smallBold" style={styles.formTitle}>
        Créer une playlist
      </ThemedText>
      <FormField label="Nom" value={name} onChangeText={setName} />
      <FilePickerField
        label="Pochette (optionnel)"
        fileName={coverFileName}
        isUploading={isUploadingCover}
        onPress={handlePickCover}
      />
      <SubmitButton
        label="Créer la playlist"
        disabled={addMutation.isPending || !name}
        onPress={() => addMutation.mutate({ name: name.trim(), cover_url: coverUrl ?? undefined })}
      />
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
    <View style={styles.trackPicker}>
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
          Ajoutez d’abord des sets ci-dessus.
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
      <ThemedText type="subtitle">Artistes SoundCloud</ThemedText>

      {artists?.map((artist) => (
        <View key={artist.id} style={styles.listRow}>
          <ThemedText style={styles.flex1} numberOfLines={1}>
            {artist.display_name}
          </ThemedText>
          <Pressable onPress={() => deleteMutation.mutate(artist.id)}>
            <DeleteIcon />
          </Pressable>
        </View>
      ))}

      <ThemedText type="smallBold" style={styles.formTitle}>
        Ajouter un artiste
      </ThemedText>
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
  onPress,
}: {
  label: string;
  fileName: string | null;
  isUploading: boolean;
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
            {isUploading ? 'Envoi en cours…' : (fileName ?? 'Choisir un fichier…')}
          </ThemedText>
          {isUploading && <ActivityIndicator size="small" color={theme.accent} />}
        </View>
      </Pressable>
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
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  trackPicker: {
    paddingLeft: Spacing.three,
    paddingBottom: Spacing.two,
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
