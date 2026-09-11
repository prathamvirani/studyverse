import type { Page } from '@playwright/test';
/** Explicit browser MediaStream fixture; does not claim native hardware capture. */
export async function syntheticMedia(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints?.audio) {
        const ctx = new AudioContext(),
          oscillator = ctx.createOscillator(),
          destination = ctx.createMediaStreamDestination();
        oscillator.frequency.value = 220;
        oscillator.connect(destination);
        oscillator.start();
        const track = destination.stream.getAudioTracks()[0]!,
          stop = track.stop.bind(track);
        track.stop = () => {
          oscillator.stop();
          void ctx.close();
          stop();
        };
        return destination.stream;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#3a6764';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#e6f1db';
      ctx.font = '28px sans-serif';
      ctx.fillText('Synthetic camera · browser test', 80, 180);
      const stream = canvas.captureStream(5);
      let frame = 0;
      const timer = setInterval(() => {
        ctx.fillStyle = '#3a6764';
        ctx.fillRect(0, 0, 640, 60);
        ctx.fillStyle = '#e6f1db';
        ctx.fillText(`Frame ${++frame}`, 30, 40);
      }, 200);
      const track = stream.getVideoTracks()[0]!,
        stop = track.stop.bind(track);
      track.stop = () => {
        clearInterval(timer);
        stop();
      };
      return stream;
    };
  });
}
