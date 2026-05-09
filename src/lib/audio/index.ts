import type { AudioService } from './AudioService';
import { DesktopAudioService } from './DesktopAudioService';
import { isAndroid } from './platform';
import { AndroidAudioService } from './AndroidAudioService';

export type { AudioService, AudioMetadata } from './AudioService';
export { isAndroid, isDesktop } from './platform';

let instance: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!instance) {
    instance = isAndroid() ? new AndroidAudioService() : new DesktopAudioService();
  }
  return instance!;
}
