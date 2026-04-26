import usePlayerStore from '../../lib/state/playerStore';
import { Volume2, VolumeX } from 'lucide-react';
import { stop } from '../../lib/tts';
import './TTSIndicator.css';

export function TTSIndicator() {
  const { isSpeaking, currentText } = usePlayerStore();

  if (!isSpeaking) return null;

  const handleStop = () => {
    stop();
  };

  return (
    <div className="tts-indicator">
      <div className="tts-icon speaking">
        <Volume2 size={14} />
        <div className="tts-waves">
          <span className="wave"></span>
          <span className="wave"></span>
          <span className="wave"></span>
        </div>
      </div>
      <div className="tts-text">
        <span className="tts-label">伊卡洛斯</span>
        <span className="tts-content">{currentText}</span>
      </div>
      <button className="tts-stop" onClick={handleStop} title="停止语音">
        <VolumeX size={14} />
      </button>
    </div>
  );
}