const colorCache = new Map<string, [string, string]>();

/**
 * Extract dominant colors from an image URL using Canvas.
 * Returns 2 hex colors suitable for background gradients.
 */
export async function extractColors(imageUrl: string): Promise<[string, string]> {
  if (colorCache.has(imageUrl)) return colorCache.get(imageUrl)!;
  const FALLBACK: [string, string] = ['#1a1a2e', '#16213e'];

  try {
    const img = await loadImage(imageUrl);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return FALLBACK;

    ctx.drawImage(img, 0, 0, 64, 64);
    const { data } = ctx.getImageData(0, 0, 64, 64);

    const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 128) continue; // skip transparent

      // Quantize to nearest 32
      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;

      const brightness = (qr * 299 + qg * 587 + qb * 114) / 1000;
      if (brightness < 30 || brightness > 220) continue;

      // Filter out saturated greens that clash with accent color
      if (qr < 80 && qg > 150 && qb < 80) continue;

      const key = `${qr},${qg},${qb}`;
      const existing = colorCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        colorCounts.set(key, { r: qr, g: qg, b: qb, count: 1 });
      }
    }

    const sorted = [...colorCounts.values()].sort((a, b) => b.count - a.count);

    if (sorted.length === 0) return FALLBACK;

    const c1 = sorted[0];
    const result: [string, string] = [rgbToHex(c1.r, c1.g, c1.b), FALLBACK[1]];

    if (sorted.length >= 2) {
      const c2 = sorted[1];
      result[1] = rgbToHex(c2.r, c2.g, c2.b);
    }

    colorCache.set(imageUrl, result);
    return result;
  } catch {
    return FALLBACK;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
