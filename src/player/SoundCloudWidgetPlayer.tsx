import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

export type SoundCloudWidgetEvent = { type: 'READY' | 'PLAY' | 'PAUSE' | 'FINISH' | 'ERROR' };

export type SoundCloudWidgetHandle = {
  play: () => void;
  pause: () => void;
};

type Props = {
  trackUrl: string;
  onEvent: (event: SoundCloudWidgetEvent) => void;
};

/**
 * Le Widget SoundCloud est conçu pour être piloté depuis la page qui l'embarque via
 * un <iframe> + le script officiel `player/api.js` (SC.Widget). En WebView React Native
 * on charge donc une mini-page HTML qui fait exactement ça, plutôt que de charger l'URL
 * du widget directement comme document racine (ce qui empêcherait tout contrôle programmatique).
 */
function buildWrapperHtml(trackUrl: string): string {
  const widgetSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    trackUrl
  )}&auto_play=true&visual=false&show_comments=false&show_user=true`;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;background:transparent;}</style>
</head>
<body>
<iframe id="sc-widget" src="${widgetSrc}" allow="autoplay"></iframe>
<script src="https://w.soundcloud.com/player/api.js"></script>
<script>
  var widget = SC.Widget(document.getElementById('sc-widget'));
  function post(type) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type }));
  }
  widget.bind(SC.Widget.Events.READY, function () { post('READY'); });
  widget.bind(SC.Widget.Events.PLAY, function () { post('PLAY'); });
  widget.bind(SC.Widget.Events.PAUSE, function () { post('PAUSE'); });
  widget.bind(SC.Widget.Events.FINISH, function () { post('FINISH'); });
  widget.bind(SC.Widget.Events.ERROR, function () { post('ERROR'); });
  window.scPlay = function () { widget.play(); };
  window.scPause = function () { widget.pause(); };
</script>
</body>
</html>`;
}

export const SoundCloudWidgetPlayer = forwardRef<SoundCloudWidgetHandle, Props>(
  function SoundCloudWidgetPlayer({ trackUrl, onEvent }, ref) {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      play: () => webViewRef.current?.injectJavaScript('window.scPlay && window.scPlay(); true;'),
      pause: () => webViewRef.current?.injectJavaScript('window.scPause && window.scPause(); true;'),
    }));

    function handleMessage(event: WebViewMessageEvent) {
      try {
        const parsed = JSON.parse(event.nativeEvent.data) as SoundCloudWidgetEvent;
        onEvent(parsed);
      } catch {
        // message non reconnu, on l'ignore
      }
    }

    return (
      <WebView
        ref={webViewRef}
        style={styles.hidden}
        source={{ html: buildWrapperHtml(trackUrl) }}
        onMessage={handleMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
      />
    );
  }
);

const styles = StyleSheet.create({
  // Le widget n'a pas besoin d'être visible : on pilote juste l'audio, l'UI est notre MiniPlayer.
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
