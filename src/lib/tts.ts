import usePlayerStore from './state/playerStore';

const API_KEY = import.meta.env.VITE_TTS_KEY || import.meta.env.VITE_CHAT_API_KEY || '';
const TTS_MODEL = import.meta.env.VITE_TTS_MODEL || 'mimo-v2.5-tts';
const TTS_API_URL = import.meta.env.VITE_TTS_URL || 'https://api.xiaomimimo.com/v1/chat/completions';
const PROXY_URL = 'http://localhost:3000/tts';

// 伊卡洛斯风格：清澈、温柔、略带冷淡但治愈的女声 - 茉莉音色
const VOICE_STYLE = '用清澈温柔的女声，语调平稳略带冷淡，像一个忠诚的天使在轻声播报，声音空灵治愈，不带太多情感起伏但能感受到关心。';

let currentAudio: HTMLAudioElement | null = null;

function updateSpeaking(speaking: boolean, text: string = '') {
  usePlayerStore.getState().setSpeaking(speaking, text);
}

export async function speak(text: string): Promise<void> {
  if (!text || !API_KEY) {
    console.log('TTS skipped:', !text ? 'no text' : 'no API key');
    return;
  }

  // Stop any currently playing TTS
  stop();

  // Update state: speaking with current text
  updateSpeaking(true, text);

  // Clean text for TTS (remove markdown, emojis, etc.)
  const cleanText = text
    .replace(/[#*`_~\[\]()>]/g, '')
    .replace(/[^一-龥a-zA-Z0-9，。！？、；：""''（）\s]/g, '')
    .trim();

  if (!cleanText) {
    console.log('TTS skipped: no clean text after filtering');
    if (updateSpeaking) updateSpeaking(false);
    return;
  }

  try {
    console.log('TTS request via proxy:', { model: TTS_MODEL, textLength: cleanText.length });

    // Use local proxy to bypass CORS
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: TTS_API_URL,
        apiKey: API_KEY,
        model: TTS_MODEL,
        messages: [
          { role: 'user', content: VOICE_STYLE },
          { role: 'assistant', content: cleanText }
        ],
        audio: {
          format: 'wav',
          voice: '茉莉'
        }
      }),
    });

    console.log('TTS response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', response.status, errorText);
      if (updateSpeaking) updateSpeaking(false);
      return;
    }

    const data = await response.json();

    // MiMo TTS returns audio in message.audio.data (base64)
    let audioSrc: string | null = null;

    if (data.choices?.[0]?.message?.audio?.data) {
      const audioData = data.choices[0].message.audio.data;
      audioSrc = `data:audio/wav;base64,${audioData}`;
    } else if (data.audio?.data) {
      audioSrc = `data:audio/wav;base64,${data.audio.data}`;
    } else if (data.data?.audio) {
      audioSrc = `data:audio/wav;base64,${data.data.audio}`;
    }

    if (audioSrc) {
      console.log('TTS audio found, playing...');
      currentAudio = new Audio(audioSrc);

      currentAudio.onended = () => {
        console.log('TTS playback finished');
        if (updateSpeaking) updateSpeaking(false);
      };

      currentAudio.onerror = (e) => {
        console.error('TTS audio error:', e);
        if (updateSpeaking) updateSpeaking(false);
      };

      currentAudio.play().catch((err) => {
        console.error('TTS playback failed:', err);
        if (updateSpeaking) updateSpeaking(false);
      });
    } else {
      console.error('TTS: No audio in response.');
      if (updateSpeaking) updateSpeaking(false);
    }
  } catch (err) {
    console.error('TTS request failed:', err);
    if (updateSpeaking) updateSpeaking(false);
  }
}

export function stop(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (updateSpeaking) updateSpeaking(false);
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}