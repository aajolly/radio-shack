const STREAM_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';

const audio = document.getElementById('player');
const statusEl = document.getElementById('np-status');

function setStatus(text) {
  statusEl.textContent = text;
}

function pickLosslessLevel(levels) {
  const isLossless = (codec = '') => /flac|alac/i.test(codec);
  const idx = levels.findIndex(
    (l) => isLossless(l.audioCodec) || isLossless(l.codecSet) || isLossless(l.attrs?.CODECS),
  );
  return idx;
}

if (window.Hls && Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(STREAM_URL);
  hls.attachMedia(audio);
  hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
    const flacIdx = pickLosslessLevel(data.levels);
    if (flacIdx >= 0) {
      hls.currentLevel = flacIdx;
      hls.autoLevelCapping = flacIdx;
      setStatus('Ready · lossless (FLAC)');
    } else {
      setStatus(`Ready · ${data.levels[hls.currentLevel]?.audioCodec ?? 'auto'}`);
    }
  });
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    setStatus(`Error: ${data.details}`);
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        hls.recoverMediaError();
        break;
      default:
        hls.destroy();
    }
  });
} else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
  audio.src = STREAM_URL;
  setStatus('Ready (native HLS)');
} else {
  setStatus('HLS not supported in this browser');
}

audio.addEventListener('playing', () => setStatus('Playing'));
audio.addEventListener('pause',   () => setStatus('Paused'));
audio.addEventListener('waiting', () => setStatus('Buffering…'));
audio.addEventListener('error',   () => setStatus('Playback error'));
