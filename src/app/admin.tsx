import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  deleteSoundCloudArtist,
  deleteTrack,
  fetchSoundCloudArtists,
  fetchTracks,
  insertSoundCloudArtist,
  insertTrack,
  signInAdmin,
  signOutAdmin,
  supabase,
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
      <SoundCloudArtistsAdmin />
    </>
  );
}

function TracksAdmin() {
  const queryClient = useQueryClient();
  const { data: tracks } = useQuery({ queryKey: ['tracks'], queryFn: fetchTracks });

  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const addMutation = useMutation({
    mutationFn: insertTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setTitle('');
      setArtistName('');
      setAudioUrl('');
      setCoverUrl('');
    },
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTrack,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tracks'] }),
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : String(e)),
  });

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="subtitle">Sets du collectif</ThemedText>

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
      <FormField
        label="URL audio (fichier hébergé, ex: Supabase Storage)"
        value={audioUrl}
        onChangeText={setAudioUrl}
        autoCapitalize="none"
      />
      <FormField label="URL pochette (optionnel)" value={coverUrl} onChangeText={setCoverUrl} autoCapitalize="none" />
      <SubmitButton
        label="Ajouter le set"
        disabled={addMutation.isPending || !title || !artistName || !audioUrl}
        onPress={() =>
          addMutation.mutate({
            title: title.trim(),
            artist_name: artistName.trim(),
            audio_url: audioUrl.trim(),
            cover_url: coverUrl.trim() || undefined,
          })
        }
      />
    </ThemedView>
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
