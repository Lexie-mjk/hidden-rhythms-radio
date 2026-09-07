import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { SoundCloudTrack } from '@/api/soundcloud';
import type { Track } from '@/api/supabase';
import { SoundCloudWidgetPlayer, type SoundCloudWidgetHandle } from '@/player/SoundCloudWidgetPlayer';

type SourceType = 'local' | 'soundcloud' | 'none';

type NowPlaying = {
  title: string;
  artist: string;
  artworkUrl: string | null;
};

type PlayerContextValue = {
  sourceType: SourceType;
  nowPlaying: NowPlaying | null;
  isPlaying: boolean;
  isBuffering: boolean;
  playLocalQueue: (tracks: Track[], startIndex?: number) => void;
  playSoundCloudQueue: (tracks: SoundCloudTrack[], startIndex: number, contextLabel: string) => void;
  togglePlayPause: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [sourceType, setSourceType] = useState<SourceType>('none');

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
      if (event.type === 'FINISH') {
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
    (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      soundCloudWidgetRef.current?.pause();
      setSourceType('local');
      setLocalQueue(tracks);
      setLocalIndex(startIndex);
      loadLocalTrack(tracks, startIndex);
    },
    [loadLocalTrack]
  );

  const skipNext = useCallback(() => {
    if (localQueue.length === 0) return;
    const nextIndex = (localIndex + 1) % localQueue.length;
    setLocalIndex(nextIndex);
    loadLocalTrack(localQueue, nextIndex);
  }, [localIndex, localQueue, loadLocalTrack]);

  const skipPrevious = useCallback(() => {
    if (localQueue.length === 0) return;
    const previousIndex = (localIndex - 1 + localQueue.length) % localQueue.length;
    setLocalIndex(previousIndex);
    loadLocalTrack(localQueue, previousIndex);
  }, [localIndex, localQueue, loadLocalTrack]);

  // Boucle de la radio : à la fin d'un morceau, on enchaîne automatiquement sur le suivant.
  // Ajustement d'état conditionnel pendant le rendu (pattern recommandé par la doc expo-audio),
  // plutôt qu'un useEffect : `didJustFinish` retombe à false dès que la source est remplacée,
  // donc cette branche ne s'exécute qu'une fois par fin de morceau.
  if (sourceType === 'local' && localStatus.didJustFinish && localQueue.length > 0) {
    const nextIndex = (localIndex + 1) % localQueue.length;
    setLocalIndex(nextIndex);
    loadLocalTrack(localQueue, nextIndex);
  }

  const playSoundCloudQueue = useCallback(
    (tracks: SoundCloudTrack[], startIndex: number, contextLabel: string) => {
      if (tracks.length === 0) return;
      localPlayer.pause();
      setSourceType('soundcloud');
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
    nowPlaying,
    isPlaying: sourceType === 'local' ? localStatus.playing : soundCloudPlaying,
    isBuffering: sourceType === 'local' && localStatus.isBuffering,
    playLocalQueue,
    playSoundCloudQueue,
    togglePlayPause,
    skipNext,
    skipPrevious,
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
