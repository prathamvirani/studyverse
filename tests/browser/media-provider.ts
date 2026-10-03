import type { Page } from '@playwright/test';
export async function providerMock(page: Page, blockedOnce = false) {
  // Explicit deterministic provider mock. This tests application synchronization, not YouTube playback.
  await page.route('https://www.youtube.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Deterministic provider fixture</title>',
    }),
  );
  await page.addInitScript((blockFirst) => {
    const w = window as unknown as {
      YT: unknown;
      mediaTest: { position: () => number; volume: () => number; destroyed: boolean }[];
    };
    w.mediaTest = [];
    w.YT = {
      Player: class {
        p = 0;
        t = Date.now();
        running = false;
        speed = 1;
        v = 100;
        destroyed = false;
        blocked = blockFirst;
        events: { onReady: () => void; onAutoplayBlocked?: () => void };
        constructor(
          _element: HTMLElement,
          options: { events: { onReady: () => void; onAutoplayBlocked?: () => void } },
        ) {
          this.events = options.events;
          const isDestroyed = () => this.destroyed;
          w.mediaTest.push({
            position: () => this.getCurrentTime(),
            volume: () => this.v,
            get destroyed() {
              return isDestroyed();
            },
          });
          setTimeout(() => options.events.onReady(), 10);
        }
        cueVideoById(_id: string, start: number) {
          this.p = start;
          this.t = Date.now();
          this.running = false;
        }
        playVideo() {
          if (this.blocked) {
            this.blocked = false;
            this.events.onAutoplayBlocked?.();
            return;
          }
          if (!this.running) {
            this.t = Date.now();
            this.running = true;
          }
        }
        pauseVideo() {
          this.p = this.getCurrentTime();
          this.running = false;
        }
        seekTo(value: number) {
          this.p = value;
          this.t = Date.now();
        }
        setPlaybackRate(value: number) {
          this.p = this.getCurrentTime();
          this.t = Date.now();
          this.speed = value;
        }
        getAvailablePlaybackRates() {
          return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        }
        getPlaybackRate() {
          return this.speed;
        }
        setVolume(value: number) {
          this.v = value;
        }
        getCurrentTime() {
          return this.p + (this.running ? ((Date.now() - this.t) / 1000) * this.speed : 0);
        }
        getDuration() {
          return 600;
        }
        getPlayerState() {
          return this.running ? 1 : 2;
        }
        destroy() {
          this.destroyed = true;
          this.pauseVideo();
        }
      },
    };
  }, blockedOnce);
}
