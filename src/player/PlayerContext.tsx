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
  playSoundCloudTrack: (track: SoundCloudTrack, artistName: string) => void;
  togglePlayPause: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [sourceType, setSourceType] = useState<SourceType>('none');

  // --- Moteur SoundCloud (widget embarqué) ---
  const soundCloudWidgetRef = useRef<SoundCloudWidgetHandle>(null);
  const [soundCloudTrack, setSoundCloudTrack] = useState<{
    permalinkUrl: string;
    title: string;
    artist: string;
    artworkUrl: string | null;
  } | null>(null);
  const [soundCloudPlaying, setSoundCloudPlaying] = useState(false);

  const handleSoundCloudEvent = useCallback((event: { type: string }) => {
    if (event.type === 'PLAY') setSoundCloudPlaying(true);
    if (event.type === 'PAUSE' || event.type === 'FINISH') setSoundCloudPlaying(false);
  }, []);

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

  const playSoundCloudTrack = useCallback((track: SoundCloudTrack, artistName: string) => {
    localPlayer.pause();
    setSourceType('soundcloud');
    setSoundCloudTrack({
      permalinkUrl: track.permalink_url,
      title: track.title,
      artist: artistName,
      artworkUrl: track.artwork_url,
    });
    setSoundCloudPlaying(true);
    // localPlayer est stable (instance unique fournie par useAudioPlayer), pas besoin de le lister.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const nowPlaying: NowPlaying | null = useMemo(() => {
    if (sourceType === 'local') {
      const track = localQueue[localIndex];
      if (!track) return null;
      return { title: track.title, artist: track.artist_name, artworkUrl: track.cover_url };
    }
    if (sourceType === 'soundcloud' && soundCloudTrack) {
      return {
        title: soundCloudTrack.title,
        artist: soundCloudTrack.artist,
        artworkUrl: soundCloudTrack.artworkUrl,
      };
    }
    return null;
  }, [localIndex, localQueue, sourceType, soundCloudTrack]);

  const value: PlayerContextValue = {
    sourceType,
    nowPlaying,
    isPlaying: sourceType === 'local' ? localStatus.playing : soundCloudPlaying,
    isBuffering: sourceType === 'local' && localStatus.isBuffering,
    playLocalQueue,
    playSoundCloudTrack,
    togglePlayPause,
    skipNext,
    skipPrevious,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {sourceType === 'soundcloud' && soundCloudTrack && (
        <SoundCloudWidgetPlayer
          ref={soundCloudWidgetRef}
          trackUrl={soundCloudTrack.permalinkUrl}
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
