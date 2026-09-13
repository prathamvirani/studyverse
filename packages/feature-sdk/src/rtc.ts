import type {
  MediaCredential,
  MediaSource,
  MediaQualityPreferences,
  MediaQualityStage,
} from '@study/contracts';
import type { Actor, Dispose } from './foundation.ts';
export interface MediaProfile {
  resolution?: 'fixed' | 'native';
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  codec?: string;
  jitter?: number;
  rtt?: number;
  packetsLost?: number;
  framesDropped?: number;
  qualityLimitation?: string;
  encodeTime?: number;
  decodeTime?: number;
  sampleRate?: number;
  channels?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}
export interface MediaTrack {
  id: string;
  participantId: string;
  userId: string;
  source: MediaSource;
  local: boolean;
  muted: boolean;
  stream: MediaStream | null;
  requested: MediaProfile;
  actual: MediaProfile;
  capture?: MediaProfile;
  effective?: MediaProfile;
  warning?: string;
}
export interface MediaSnapshot {
  connection: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  tracks: readonly MediaTrack[];
}
export type ReceiveSurface = 'circle' | 'workspace' | 'hidden';
/** Product code never handles SFU SDK objects. Each instance owns one connection. */
export interface RealtimeMediaProvider {
  snapshot(): MediaSnapshot;
  listen(changed: () => void): Dispose;
  connect(credential: MediaCredential): Promise<void>;
  disconnect(): Promise<void>;
  publish(source: MediaSource, deviceId?: string, voice?: 'standard' | 'high'): Promise<void>;
  unpublish(source: MediaSource): Promise<void>;
  mute(source: MediaSource, muted: boolean): Promise<void>;
  switchDevice(source: 'microphone' | 'camera', deviceId: string): Promise<void>;
  receive(trackId: string, surface: ReceiveSurface, size?: { width: number; height: number }): void;
  quality?: {
    capabilities(): { stage: MediaQualityStage; codecs: string[]; processing: string[] };
    preferences(): MediaQualityPreferences;
    apply(preferences: MediaQualityPreferences): Promise<void>;
  };
  devices(): Promise<MediaDeviceInfo[]>;
}
export interface MediaAuthority {
  /** Admission capability, independent of best-effort media resource policy. */
  readonly enforcement: { scopedGrants: boolean };
  participants?(roomId: string): Promise<{ connectionId: string; publishing: boolean }[]>;
  reset?(): Promise<void>;
  /** Remove provider sessions absent from the current application-authorized inventory. */
  reconcile?(allowed: (roomId: string, connectionId: string) => boolean): Promise<void>;
  issue(input: {
    actor: Actor;
    roomId: string;
    connectionId: string;
    expiresAt: number;
    sources: MediaSource[];
  }): Promise<MediaCredential>;
  remove(roomId: string, connectionId: string): Promise<void>;
}
