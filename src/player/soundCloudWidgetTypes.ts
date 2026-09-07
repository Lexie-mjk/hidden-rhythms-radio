export type SoundCloudWidgetEvent = { type: 'READY' | 'PLAY' | 'PAUSE' | 'FINISH' | 'ERROR' };

export type SoundCloudWidgetHandle = {
  play: () => void;
  pause: () => void;
};
