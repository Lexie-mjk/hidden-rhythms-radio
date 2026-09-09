import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { SoundCloudTrack } from '@/api/soundcloud';
import type { Track } from '@/api/supabase';
import { SoundCloudWidgetPlayer, type SoundCloudWidgetHandle } from '@/player/SoundCloudWidgetPlayer';
import { shuffle } from '@/utils/shuffle';

type SourceType = 'local' | 'soundcloud' | 'none';

// D'où vient la file en cours — détermine ce que l'écran plein écran propose : la Radio
// reste un flux continu sans retour arrière ni mélange (déjà aléatoire par nature), les
// playlists ont précédent/suivant/mélanger, les pages Artiste ont précédent/suivant seul.
type QueueContext = 'radio' | 'playlist' | 'artist' | null;

type NowPlaying = {
  title: string;
  artist: string;
  artworkUrl: string | null;
};

type PlayerContextValue = {
  sourceType: SourceType;
  queueContext: QueueContext;
  nowPlaying: NowPlaying | null;
  isPlaying: boolean;
  isBuffering: boolean;
  playLocalQueue: (tracks: Track[], startIndex?: number, context?: QueueContext) => void;
  playSoundCloudQueue: (
    tracks: SoundCloudTrack[],
    startIndex: number,
    contextLabel: string,
    context?: QueueContext
  ) => void;
  togglePlayPause: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
  shuffleQueue: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [sourceType, setSourceType] = useState<SourceType>('none');
  const [queueContext, setQueueContext] = useState<QueueContext>(null);

  // Sans ça, iOS garde la catégorie de session audio par défaut : le bouton silencieux coupe
  // le son sur le haut-parleur du téléphone, mais pas sur un accessoire Bluetooth déjà connecté
  // (d'où "ça marche seulement au casque"). playsInSilentMode force la lecture même en mode
  // silencieux ; shouldPlayInBackground correspond au plugin expo-audio déjà activé (app.json).
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  }, []);

  // --- Moteur SoundCloud (widget embarqué) ---
  const soundCloudWidgetRef = useRef<SoundCloudWidgetHandle>(null);
  const [soundCloudQueue, setSoundCloudQueue] = useState<SoundCloudTrack[]>([]);
  const [soundCloudIndex, setSoundCloudIndex] = useState(0);
  const [soundCloudContextLabel, setSoundCloudContextLabel] = useState('');
  const [soundCloudPlaying, setSoundCloudPlaying] = useState(false);

  const handleSoundCloudEvent = useCallback(
    (event: { type: string }) => {
      if (event.type === 'PLAY') setSoundCloudPlaying(true);
      if (event.type === 'PAUSE') setSoundCloudPlaying(false);
      if (event.type === 'FINISH' || event.type === 'ERROR') {
        // ERROR (morceau privé/supprimé/indisponible) traité comme FINISH : sans ça, la lecture
        // restait bloquée en silence sur un morceau qui ne joue jamais, sans retour à l'auditeur.
        // Enchaîne sur le morceau suivant de la file (boucle en fin de file), comme la radio locale.
        setSoundCloudPlaying(false);
        setSoundCloudIndex((current) =>
          soundCloudQueue.length > 0 ? (current + 1) % soundCloudQueue.length : current
        );
      }
    },
    [soundCloudQueue.length]
  );

  // --- Moteur local (catalogue propre du collectif) ---
  const localPlayer = useAudioPlayer(null);
  const localStatus = useAudioPlayerStatus(localPlayer);
  const [localQueue, setLocalQueue] = useState<Track[]>([]);
  const [localIndex, setLocalIndex] = useState(0);

  const loadLocalTrack = useCallback(
    (queue: Track[], index: number) => {
      const track = queue[index];
      if (!track) return;
      localPlayer.replace({ uri: track.audio_url });
      localPlayer.play();
      localPlayer.setActiveForLockScreen(true, {
        title: track.title,
        artist: track.artist_name,
        artworkUrl: track.cover_url ?? undefined,
      });
    },
    [localPlayer]
  );

  const playLocalQueue = useCallback(
    (tracks: Track[], startIndex = 0, context: QueueContext = null) => {
      if (tracks.length === 0) return;
      soundCloudWidgetRef.current?.pause();
      setSourceType('local');
      setQueueContext(context);
      setLocalQueue(tracks);
      setLocalIndex(startIndex);
      loadLocalTrack(tracks, startIndex);
    },
    [loadLocalTrack]
  );

  const skipNext = useCallback(() => {
    if (sourceType === 'local') {
      if (localQueue.length === 0) return;
      const nextIndex = (localIndex + 1) % localQueue.length;
      setLocalIndex(nextIndex);
      loadLocalTrack(localQueue, nextIndex);
    } else if (sourceType === 'soundcloud') {
      if (soundCloudQueue.length === 0) return;
      setSoundCloudIndex((current) => (current + 1) % soundCloudQueue.length);
      setSoundCloudPlaying(true);
    }
  }, [sourceType, localIndex, localQueue, loadLocalTrack, soundCloudQueue.length]);

  const skipPrevious = useCallback(() => {
    if (sourceType === 'local') {
      if (localQueue.length === 0) return;
      const previousIndex = (localIndex - 1 + localQueue.length) % localQueue.length;
      setLocalIndex(previousIndex);
      loadLocalTrack(localQueue, previousIndex);
    } else if (sourceType === 'soundcloud') {
      if (soundCloudQueue.length === 0) return;
      setSoundCloudIndex((current) => (current - 1 + soundCloudQueue.length) % soundCloudQueue.length);
      setSoundCloudPlaying(true);
    }
  }, [sourceType, localIndex, localQueue, loadLocalTrack, soundCloudQueue.length]);

  const shuffleQueue = useCallback(() => {
    // Garde le morceau en cours en tête de la nouvelle file : la lecture n'est pas interrompue,
    // seul l'ordre du "suivant" change.
    if (sourceType === 'local') {
      if (localQueue.length < 2) return;
      const current = localQueue[localIndex];
      const rest = localQueue.filter((_, i) => i !== localIndex);
      setLocalQueue([current, ...shuffle(rest)]);
      setLocalIndex(0);
    } else if (sourceType === 'soundcloud') {
      if (soundCloudQueue.length < 2) return;
      const current = soundCloudQueue[soundCloudIndex];
      const rest = soundCloudQueue.filter((_, i) => i !== soundCloudIndex);
      setSoundCloudQueue([current, ...shuffle(rest)]);
      setSoundCloudIndex(0);
    }
  }, [sourceType, localIndex, localQueue, soundCloudIndex, soundCloudQueue]);

  // Boucle de la radio : à la fin d'un morceau, on enchaîne automatiquement sur le suivant.
  // Ajustement d'état conditionnel pendant le rendu (pattern recommandé par la doc expo-audio),
  // plutôt qu'un useEffect : `didJustFinish` retombe à false dès que la source est remplacée,
  // donc cette branche ne s'exécute qu'une fois par fin de morceau.
  if (sourceType === 'local' && localStatus.didJustFinish && localQueue.length > 0) {
    const nextIndex = (localIndex + 1) % localQueue.length;
    setLocalIndex(nextIndex);
    loadLocalTrack(localQueue, nextIndex);
  }

  // Fichier audio inaccessible (URL R2 cassée, etc.) : sans ça, la lecture restait bloquée en
  // silence sur ce morceau. Même pattern que didJustFinish ci-dessus (retombe à null dès que
  // loadLocalTrack remplace la source, donc cette branche ne s'exécute qu'une fois par erreur).
  if (sourceType === 'local' && localStatus.error && localQueue.length > 0) {
    const nextIndex = (localIndex + 1) % localQueue.length;
    setLocalIndex(nextIndex);
    loadLocalTrack(localQueue, nextIndex);
  }

  const playSoundCloudQueue = useCallback(
    (tracks: SoundCloudTrack[], startIndex: number, contextLabel: string, context: QueueContext = null) => {
      if (tracks.length === 0) return;
      localPlayer.pause();
      setSourceType('soundcloud');
      setQueueContext(context);
      setSoundCloudQueue(tracks);
      setSoundCloudIndex(startIndex);
      setSoundCloudContextLabel(contextLabel);
      setSoundCloudPlaying(true);
    },
    // localPlayer est stable (instance unique fournie par useAudioPlayer), pas besoin de le lister.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const togglePlayPause = useCallback(() => {
    if (sourceType === 'local') {
      if (localStatus.playing) {
        localPlayer.pause();
      } else {
        localPlayer.play();
      }
    } else if (sourceType === 'soundcloud') {
      if (soundCloudPlaying) {
        soundCloudWidgetRef.current?.pause();
      } else {
        soundCloudWidgetRef.current?.play();
      }
    }
  }, [localPlayer, localStatus.playing, soundCloudPlaying, sourceType]);

  const soundCloudCurrentTrack = soundCloudQueue[soundCloudIndex];

  const nowPlaying: NowPlaying | null = useMemo(() => {
    if (sourceType === 'local') {
      const track = localQueue[localIndex];
      if (!track) return null;
      return { title: track.title, artist: track.artist_name, artworkUrl: track.cover_url };
    }
    if (sourceType === 'soundcloud' && soundCloudCurrentTrack) {
      return {
        title: soundCloudCurrentTrack.title,
        artist: soundCloudContextLabel,
        artworkUrl: soundCloudCurrentTrack.artwork_url,
      };
    }
    return null;
  }, [localIndex, localQueue, sourceType, soundCloudContextLabel, soundCloudCurrentTrack]);

  const value: PlayerContextValue = {
    sourceType,
    queueContext,
    nowPlaying,
    isPlaying: sourceType === 'local' ? localStatus.playing : soundCloudPlaying,
    isBuffering: sourceType === 'local' && localStatus.isBuffering,
    playLocalQueue,
    playSoundCloudQueue,
    togglePlayPause,
    skipNext,
    skipPrevious,
    shuffleQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {sourceType === 'soundcloud' && soundCloudCurrentTrack && (
        <SoundCloudWidgetPlayer
          ref={soundCloudWidgetRef}
          trackUrl={soundCloudCurrentTrack.permalink_url}
          onEvent={handleSoundCloudEvent}
        />
      )}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer doit être utilisé à l’intérieur de <PlayerProvider>.');
  return context;
}
