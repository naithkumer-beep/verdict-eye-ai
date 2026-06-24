// Client-side image utilities: technical validation + perceptual hash.

export interface TechnicalCheck {
  ok: boolean;
  reason?: string;
  width?: number;
  height?: number;
  size?: number;
  mime?: string;
}

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_DIM = 8000;

export async function technicalValidate(file: File): Promise<TechnicalCheck> {
  if (!ACCEPTED_MIME.includes(file.type)) {
    return { ok: false, reason: "Unsupported format. Use JPEG, PNG, or WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "File too large (max 8MB)." };
  }
  if (file.size < 1024) {
    return { ok: false, reason: "File suspiciously small or corrupt." };
  }

  // Probe dimensions and corruption by decoding
  const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

  if (!dims) return { ok: false, reason: "Image is corrupted or unreadable." };
  if (dims.w > MAX_DIM || dims.h > MAX_DIM) {
    return { ok: false, reason: "Image dimensions exceed maximum." };
  }

  return { ok: true, width: dims.w, height: dims.h, size: file.size, mime: file.type };
}

// Simple 16x16 average-hash (aHash) — fast and good enough for near-duplicate
// detection at the server level. Returns 64-char hex.
export async function computePerceptualHash(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const gray = new Array<number>(size * size);
    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[p] = g;
      sum += g;
    }
    const avg = sum / gray.length;
    let bits = "";
    for (const g of gray) bits += g > avg ? "1" : "0";
    // Convert 256 bits to 64 hex chars
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } finally {
    URL.revokeObjectURL(url);
  }
}
