import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { SoundCloudWidgetEvent, SoundCloudWidgetHandle } from '@/player/soundCloudWidgetTypes';

export type { SoundCloudWidgetEvent, SoundCloudWidgetHandle };

type Props = {
  trackUrl: string;
  onEvent: (event: SoundCloudWidgetEvent) => void;
};

// Minimal, non exhaustif : seule la portion du Widget JS API utilisée ici.
type ScWidget = {
  bind: (eventName: string, callback: () => void) => void;
  play: () => void;
  pause: () => void;
};
type ScGlobal = {
  Widget: ((iframe: HTMLIFrameElement) => ScWidget) & { Events: Record<string, string> };
};

declare global {
  interface Window {
    SC?: ScGlobal;
  }
}

/**
 * react-native-webview (version compatible avec ce SDK Expo) n'a pas d'implémentation web —
 * sur le web on n'en a de toute façon pas besoin : une vraie <iframe> du navigateur suffit,
 * pilotée par le script officiel `player/api.js` exactement comme le préconise SoundCloud
 * pour un embed sur une page web classique.
 */
function buildWidgetSrc(trackUrl: string): string {
  const url = new URL('https://w.soundcloud.com/player/');
  url.searchParams.set('url', trackUrl);
  url.searchParams.set('auto_play', 'true');
  url.searchParams.set('visual', 'false');
  url.searchParams.set('show_comments', 'false');
  url.searchParams.set('show_user', 'true');
  return url.toString();
}

let widgetApiPromise: Promise<void> | null = null;
function loadWidgetApi(): Promise<void> {
  if (window.SC?.Widget) return Promise.resolve();
  if (!widgetApiPromise) {
    widgetApiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Impossible de charger le Widget SoundCloud.'));
      document.head.appendChild(script);
    });
  }
  return widgetApiPromise;
}

export const SoundCloudWidgetPlayer = forwardRef<SoundCloudWidgetHandle, Props>(
  function SoundCloudWidgetPlayer({ trackUrl, onEvent }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const widgetRef = useRef<ScWidget | null>(null);

    useImperativeHandle(ref, () => ({
      play: () => widgetRef.current?.play(),
      pause: () => widgetRef.current?.pause(),
    }));

    useEffect(() => {
      let cancelled = false;
      widgetRef.current = null;
      loadWidgetApi().then(() => {
        if (cancelled || !iframeRef.current || !window.SC) return;
        const widget = window.SC.Widget(iframeRef.current);
        widgetRef.current = widget;
        widget.bind(window.SC.Widget.Events.PLAY, () => onEvent({ type: 'PLAY' }));
        widget.bind(window.SC.Widget.Events.PAUSE, () => onEvent({ type: 'PAUSE' }));
        widget.bind(window.SC.Widget.Events.FINISH, () => onEvent({ type: 'FINISH' }));
        widget.bind(window.SC.Widget.Events.ERROR, () => onEvent({ type: 'ERROR' }));
      });
      return () => {
        cancelled = true;
      };
    }, [trackUrl, onEvent]);

    return (
      <iframe
        ref={iframeRef}
        src={buildWidgetSrc(trackUrl)}
        allow="autoplay"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, border: 0 }}
      />
    );
  }
);
