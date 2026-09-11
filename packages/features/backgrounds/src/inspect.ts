/** Bounded structural preflight before invoking a native image decoder. No filename/MIME trust. */
export function inspectImage(bytes: Uint8Array) {
  const invalid = (): never => {
    throw new Error('Unsupported or malformed image. Use PNG, JPEG or GIF.');
  };
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw new Error('Images must be at most 5 MB.');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n));
  const bounds = (w: number, h: number, frames = 1) => {
    if (
      w < 1 ||
      h < 1 ||
      w > 4096 ||
      h > 4096 ||
      w * h > 12_000_000 ||
      frames > 60 ||
      w * h * frames > 40_000_000
    )
      throw new Error(
        'Image exceeds the dimension or animation budget (4096px, 12 MP, 60 frames / 40 MP total).',
      );
  };
  if (text(0, 8) === '\x89PNG\r\n\x1a\n') {
    let p = 8,
      w = 0,
      h = 0,
      ended = false;
    while (p + 12 <= bytes.length) {
      const n = v.getUint32(p),
        type = text(p + 4, 4);
      if (n > bytes.length - p - 12) invalid();
      if (p === 8) {
        if (type !== 'IHDR' || n !== 13) invalid();
        w = v.getUint32(p + 8);
        h = v.getUint32(p + 12);
        bounds(w, h);
      }
      if (type === 'acTL') throw new Error('Animated PNG is not supported. Use a bounded GIF.');
      p += n + 12;
      if (type === 'IEND') {
        if (n !== 0 || p !== bytes.length) invalid();
        ended = true;
        break;
      }
    }
    if (!ended) invalid();
    return { mime: 'image/png', width: w, height: h, frames: 1 };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let p = 2,
      w = 0,
      h = 0;
    while (p + 4 < bytes.length) {
      if (bytes[p++] !== 255) invalid();
      while (bytes[p] === 255) p++;
      const marker = bytes[p++]!;
      if (marker === 0xda) break;
      const n = v.getUint16(p);
      if (n < 2 || p + n > bytes.length) invalid();
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (n < 8) invalid();
        h = v.getUint16(p + 3);
        w = v.getUint16(p + 5);
        bounds(w, h);
      }
      p += n;
    }
    if (!w || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) invalid();
    return { mime: 'image/jpeg', width: w, height: h, frames: 1 };
  }
  if (['GIF87a', 'GIF89a'].includes(text(0, 6)) && bytes.length >= 14) {
    const w = v.getUint16(6, true),
      h = v.getUint16(8, true);
    bounds(w, h);
    let p = 13,
      frames = 0;
    if (bytes[10]! & 128) p += 3 * 2 ** ((bytes[10]! & 7) + 1);
    const blocks = () => {
      while (p < bytes.length) {
        const n = bytes[p++]!;
        if (!n) return;
        p += n;
        if (p > bytes.length) invalid();
      }
      invalid();
    };
    while (p < bytes.length) {
      const kind = bytes[p++];
      if (kind === 0x3b) {
        if (p !== bytes.length || !frames) invalid();
        return { mime: 'image/gif', width: w, height: h, frames };
      }
      if (kind === 0x21) {
        if (p >= bytes.length) invalid();
        p++;
        blocks();
      } else if (kind === 0x2c) {
        if (p + 9 >= bytes.length) invalid();
        const x = v.getUint16(p, true),
          y = v.getUint16(p + 2, true),
          fw = v.getUint16(p + 4, true),
          fh = v.getUint16(p + 6, true),
          packed = bytes[p + 8]!;
        if (!fw || !fh || x + fw > w || y + fh > h) invalid();
        p += 9;
        if (packed & 128) p += 3 * 2 ** ((packed & 7) + 1);
        if (bytes[p]! < 2 || bytes[p]! > 8) invalid();
        p++;
        blocks();
        frames++;
        bounds(w, h, frames);
      } else invalid();
    }
    invalid();
  }
  return invalid();
}
