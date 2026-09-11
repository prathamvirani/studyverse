import { inspectImage } from '@study/backgrounds/browser';
import type { LocalVisualAsset } from '@study/feature-sdk';
interface DecodedFrame {
  image: ImageBitmap & { duration?: number };
  complete: boolean;
}
interface Decoder {
  tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } };
  decode(options: { frameIndex: number; completeFramesOnly: boolean }): Promise<DecodedFrame>;
  close(): void;
}
type DecoderConstructor = new (options: {
  data: Uint8Array;
  type: string;
  preferAnimation: boolean;
}) => Decoder;
export async function importBackground(file: File): Promise<LocalVisualAsset> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be at most 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer()),
    info = inspectImage(bytes);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id =
    'custom-' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const scale = Math.min(1, 1920 / info.width, 1080 / info.height),
    width = Math.max(1, Math.round(info.width * scale)),
    height = Math.max(1, Math.round(info.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const encode = (c: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Image encoding failed.'))),
        'image/webp',
        0.86,
      ),
    );
  const frames: Blob[] = [],
    durations: number[] = [];
  let thumbnail: Blob | undefined,
    total = 0;
  const save = async (image: CanvasImageSource, duration: number) => {
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await encode(canvas);
    if (blob.type !== 'image/webp')
      throw new Error('This browser cannot safely encode this image.');
    total += blob.size;
    if (total > 12 * 1024 * 1024) throw new Error('Animation exceeds the 12 MB processed limit.');
    frames.push(blob);
    durations.push(Math.min(5000, Math.max(100, duration)));
    if (!thumbnail) {
      const small = document.createElement('canvas');
      const thumbnailScale = Math.min(1, 240 / width, 135 / height);
      small.width = Math.max(1, Math.round(width * thumbnailScale));
      small.height = Math.max(1, Math.round(height * thumbnailScale));
      small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height);
      thumbnail = await encode(small);
    }
  };
  if (info.frames > 1) {
    const ImageDecoder = (globalThis as unknown as { ImageDecoder?: DecoderConstructor })
      .ImageDecoder;
    if (!ImageDecoder)
      throw new Error(
        'Animated GIF imports need a browser with ImageDecoder support. Static PNG and JPEG still work.',
      );
    const decoder = new ImageDecoder({ data: bytes, type: info.mime, preferAnimation: true });
    try {
      await decoder.tracks.ready;
      if (decoder.tracks.selectedTrack?.frameCount !== info.frames)
        throw new Error('Malformed animation.');
      for (let i = 0; i < info.frames; i++) {
        const { image, complete } = await decoder.decode({
          frameIndex: i,
          completeFramesOnly: true,
        });
        try {
          if (!complete) throw new Error('Incomplete frame.');
          await save(image, (image.duration ?? 100000) / 1000);
        } finally {
          image.close();
        }
      }
    } finally {
      decoder.close();
    }
  } else {
    const image = await createImageBitmap(new Blob([bytes], { type: info.mime }));
    try {
      if (image.width * image.height > 12_000_000) throw new Error('Image too large.');
      await save(image, 1000);
    } finally {
      image.close();
    }
  }
  return {
    id,
    title: 'Custom image',
    frames,
    durations,
    thumbnail: thumbnail!,
    width,
    height,
    bytes: total + thumbnail!.size,
  };
}
