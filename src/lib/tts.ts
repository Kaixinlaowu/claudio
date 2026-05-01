import { invoke } from '@tauri-apps/api/core';
import usePlayerStore from './state/playerStore';

let currentAudio: HTMLAudioElement | null = null;

function updateSpeaking(speaking: boolean, text: string = '') {
  usePlayerStore.getState().setSpeaking(speaking, text);
}

export async function speak(text: string): Promise<void> {
  if (!text) {
    console.log('TTS skipped: no text');
    return;
  }

  stop();

  updateSpeaking(true, text);

  const cleanText = text
    .replace(/[#*`_~\[\]()>]/g, '')
    .replace(/[^一-龥a-zA-Z0-9，。！？、；：""''（）\s]/g, '')
    .trim();

  if (!cleanText) {
    console.log('TTS skipped: no clean text after filtering');
    updateSpeaking(false);
    return;
  }

  try {
    console.log('TTS via Tauri IPC, text length:', cleanText.length);

    const audioBase64 = await invoke<string>('tts_synthesize', {
      text: cleanText,
      apiKey: import.meta.env.VITE_TTS_KEY || '',
      model: import.meta.env.VITE_TTS_MODEL || '',
      apiUrl: import.meta.env.VITE_TTS_URL || '',
    });

    if (audioBase64) {
      console.log('TTS audio received, playing...');
      const audioSrc = `data:audio/wav;base64,${audioBase64}`;
      currentAudio = new Audio(audioSrc);

      currentAudio.onended = () => {
        console.log('TTS playback finished');
        updateSpeaking(false);
      };

      currentAudio.onerror = (e) => {
        console.error('TTS audio error:', e);
        updateSpeaking(false);
      };

      currentAudio.play().catch((err) => {
        console.error('TTS playback failed:', err);
        updateSpeaking(false);
      });
    } else {
      console.error('TTS: No audio data');
      updateSpeaking(false);
    }
  } catch (err) {
    console.error('TTS request failed:', err);
    updateSpeaking(false);
  }
}

export function stop(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  updateSpeaking(false);
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}
