/* global Image, btoa, document */
// Original project vector scenes. Deterministic source + raster/thumbnail build; no remote content.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const root = 'apps/web/public/backgrounds';
await mkdir(root, { recursive: true });
const rect = (x, y, w, h, c, r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const path = (d, c) => `<path d="${d}" fill="${c}"/>`;
const circle = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const wrap = (body, sky = '#354954', end = '#b6b5a2') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${end}"/></linearGradient><radialGradient id="glow"><stop stop-color="#ffe3a3" stop-opacity=".4"/><stop offset="1" stop-color="#ffe3a3" stop-opacity="0"/></radialGradient></defs>${body}</svg>`;
const plant = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})">${path('M-30 0H30L23 62H-23Z', '#b78466')}<path d="M0 0V-150M0-50Q-70-55-60-100Q-5-110 0-50M0-85Q65-90 60-135Q5-140 0-85M0-110Q-40-135-20-178Q20-160 0-110" stroke="#4e7160" stroke-width="8" fill="#527d68"/></g>`;
let library =
  rect(0, 0, 1920, 1080, '#273e3d') +
  rect(600, 90, 710, 670, '#172f33', 350) +
  rect(625, 115, 660, 620, 'url(#sky)', 320);
library +=
  circle(1090, 280, 65, '#ddd7ae') +
  path('M625 560L730 390 830 500 930 360 1040 540 1140 430 1285 600V735H625Z', '#526c69');
for (const x of [40, 1370]) {
  library += rect(x, 70, 500, 760, '#4d3f33', 8);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 18; i++) {
      const h = 100 + ((i * 19 + row * 37) % 60);
      library += rect(
        x + 20 + i * 26,
        245 + row * 180 - h,
        18 + (i % 4),
        h,
        ['#7b8f7c', '#b69a6a', '#79655e', '#596f70', '#c1ad8a'][i % 5],
        2,
      );
    }
    library += rect(x, 245 + row * 180, 500, 16, '#ab8156');
  }
}
library +=
  rect(0, 860, 1920, 220, '#443b34') +
  path('M300 925L1500 895 1720 1080H110Z', '#676453') +
  rect(480, 800, 960, 42, '#a78055', 12) +
  rect(530, 842, 35, 238, '#433b31') +
  rect(1350, 842, 35, 238, '#433b31');
library +=
  circle(1120, 720, 210, 'url(#glow)') +
  rect(1114, 620, 12, 178, '#c6a77a') +
  path('M1060 620L1180 620 1150 560H1090Z', '#d9b277') +
  path('M760 780Q850 740 940 780V810Q850 778 760 810Z', '#e0d5b6') +
  plant(370, 825, 1.2);
let studio =
  rect(0, 0, 1920, 1080, '#d7d3be') +
  rect(120, 80, 1050, 620, '#f6ebcd', 8) +
  rect(140, 100, 1010, 580, 'url(#sky)') +
  circle(940, 270, 95, '#f7e8b9');
studio +=
  path('M140 580Q400 280 620 510T1150 480V680H140Z', '#a6b9a0') +
  rect(630, 100, 18, 580, '#eee5cd') +
  rect(140, 380, 1010, 16, '#eee5cd') +
  path('M1170 110L1660 840H920L430 690Z', '#e9dfbd') +
  rect(0, 880, 1920, 200, '#b7a58b');
studio +=
  rect(420, 770, 1050, 36, '#9b7755', 10) +
  rect(470, 806, 28, 274, '#81644f') +
  rect(1390, 806, 28, 274, '#81644f') +
  rect(820, 617, 245, 145, '#5c716c', 7) +
  rect(830, 627, 225, 123, '#b9c1a7', 3) +
  rect(925, 762, 35, 10, '#646e60') +
  plant(1310, 765, 1.1) +
  rect(580, 750, 170, 18, '#8a9b88', 4) +
  rect(570, 735, 180, 15, '#e7dcc1', 3) +
  circle(1150, 746, 24, '#eee0bd');
studio +=
  rect(1420, 160, 290, 360, '#aa8f72', 8) +
  rect(1435, 175, 260, 330, '#eee3c7') +
  circle(1565, 270, 58, '#c7a57b') +
  path('M1435 450L1510 340 1580 420 1695 360V505H1435Z', '#798d78');
let lake =
  rect(0, 0, 1920, 1080, 'url(#sky)') +
  circle(1320, 250, 78, '#f3e1bb') +
  path('M0 670L350 230 560 530 870 180 1220 580 1450 280 1920 710Z', '#8faaa8') +
  path('M690 410L870 180 1040 415 870 360 810 390 765 345Z', '#dee2d3') +
  path('M0 730L400 510 650 690 1180 430 1530 670 1920 550V880H0Z', '#506f71') +
  rect(0, 780, 1920, 300, '#729495');
for (let i = 0; i < 22; i++)
  lake += rect(330 + ((i * 113) % 1200), 800 + i * 12, 100 + ((i * 37) % 300), 2, '#bed0ba');
for (let i = 0; i < 17; i++) {
  const x = i * 95 - 120,
    y = 890 + (i % 3) * 18,
    h = 170 + ((i * 43) % 130);
  lake += path(`M${x} ${y - h}L${x - 80} ${y}H${x + 80}Z`, '#294d4d');
}
lake += path('M0 1010Q420 930 680 1080H0Z', '#233f3e');
let rain =
  rect(0, 0, 1920, 1080, '#35444b') +
  rect(340, 60, 1250, 790, '#1d303b', 18) +
  rect(365, 85, 1200, 740, 'url(#sky)', 8);
for (let i = 0; i < 20; i++) {
  const x = 365 + i * 60,
    h = 140 + ((i * 89) % 300);
  rain += rect(x, 825 - h, 54, h, ['#304452', '#415562', '#384c5c'][i % 3]);
  for (let j = 0; j < 7; j++)
    if (j * 40 < h)
      rain += rect(x + 12, 825 - h + 20 + j * 40, 12, 16, j % 3 === 0 ? '#c2a478' : '#728583');
}
rain +=
  rect(945, 85, 20, 740, '#20343f') +
  rect(365, 450, 1200, 20, '#20343f') +
  rect(310, 825, 1310, 38, '#987555') +
  rect(0, 920, 1920, 160, '#27373c') +
  rect(490, 900, 950, 35, '#947355', 10) +
  plant(1450, 825, 0.9) +
  circle(560, 755, 190, 'url(#glow)') +
  path('M520 735H620L600 670H540Z', '#d9b87d') +
  rect(566, 735, 8, 165, '#c9a67a') +
  rect(790, 877, 230, 20, '#7c9694', 3) +
  rect(805, 855, 190, 22, '#c4b999', 3);
let night = rect(0, 0, 1920, 1080, 'url(#sky)');
for (let i = 0; i < 120; i++)
  night += circle((i * 317) % 1920, (i * 191) % 720, 1 + (i % 2), i % 3 ? '#a6b7ce' : '#e3d7b9');
night +=
  circle(1270, 260, 83, '#e5dfc8') +
  circle(1295, 239, 78, '#192c43') +
  path('M0 810L330 600 620 840 970 510 1260 750 1580 600 1920 820V1080H0Z', '#263d4d') +
  path('M0 925L520 770 1020 910 1490 820 1920 900V1080H0Z', '#172c36') +
  rect(0, 980, 1920, 100, '#162730');
night +=
  rect(500, 870, 450, 210, '#435653') +
  path('M485 870A240 240 0 0 1 480 -10', 'none') +
  path('M485 870A240 240 0 0 1 965 870Z', '#60716c') +
  rect(690, 895, 65, 110, '#d0b887', 30) +
  rect(0, 990, 1920, 14, '#83908a');
const scenes = {
  'cedar-library': wrap(library),
  'morning-studio': wrap(studio, '#b2c9c6', '#e1dfbd'),
  'alpine-lake': wrap(lake, '#a2bfc2', '#e0d9b9'),
  'rainy-window': wrap(rain, '#34485e', '#8d9390'),
  'night-observatory': wrap(night, '#111f36', '#40576d'),
};
scenes['quiet-hours'] = await readFile('apps/web/public/quiet-hours.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const manifest = [];
for (const [id, svg] of Object.entries(scenes)) {
  await writeFile(`${root}/${id}.svg`, svg);
  for (const [suffix, width, height] of [
    ['', 1920, 1080],
    ['-thumb', 320, 180],
  ]) {
    const base64 = await page.evaluate(
      async ({ svg, width, height }) => {
        const image = new Image();
        image.src = 'data:image/svg+xml;base64,' + btoa(svg);
        await image.decode();
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        c.getContext('2d').drawImage(image, 0, 0, width, height);
        return c.toDataURL('image/webp', 0.88).split(',')[1];
      },
      { svg, width, height },
    );
    await writeFile(`${root}/${id}${suffix}.webp`, Buffer.from(base64, 'base64'));
  }
  manifest.push({
    id,
    title: {
      'quiet-hours': 'The quiet hours',
      'cedar-library': 'Cedar library',
      'morning-studio': 'Morning studio',
      'alpine-lake': 'Alpine stillness',
      'rainy-window': 'Rain at the window',
      'night-observatory': 'After midnight',
    }[id],
    origin: 'Project-created vector illustration',
    creator: 'Study platform project / Codex',
    license: 'Project-owned original asset; no third-party source material',
    attributionRequired: false,
    kind: ['rainy-window', 'night-observatory'].includes(id)
      ? 'animated visual (static original + CSS seamless loop)'
      : 'static',
    dimensions: { width: 1920, height: 1080 },
    bytes: (await stat(`${root}/${id}.webp`)).size,
    thumbnailBytes: (await stat(`${root}/${id}-thumb.webp`)).size,
    source: `${id}.svg`,
    renderer: 'apps/web/app/components/backgrounds/EnvironmentSurface.vue',
  });
}
await browser.close();
await writeFile(`${root}/provenance.json`, JSON.stringify(manifest, null, 2) + '\n');
