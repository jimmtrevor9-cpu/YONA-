/**
 * Lecture des images pour la vérification d'identité (serveur) : JPEG, PNG ou WebP, remise
 * à l'endroit (orientation des photos de téléphone), réduite à 1 024 px au plus, en RVB.
 */
export interface RgbImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export async function decodeImage(bytes: Uint8Array, maxSide = 1024): Promise<RgbImage> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
    width: info.width,
    height: info.height,
  };
}

/**
 * Netteté d'une zone (le visage) : variance du laplacien sur l'image en gris ramenée à
 * 128 × 128. Une image floue donne une valeur faible.
 */
export async function sharpness(
  image: RgbImage,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const sharp = (await import("sharp")).default;
  const left = Math.max(0, Math.floor(box.x));
  const top = Math.max(0, Math.floor(box.y));
  const width = Math.max(8, Math.min(image.width - left, Math.ceil(box.width)));
  const height = Math.max(8, Math.min(image.height - top, Math.ceil(box.height)));
  if (left + width > image.width || top + height > image.height) return 0;
  const size = 128;
  const gray = await sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 3 },
  })
    .extract({ left, top, width, height })
    .resize(size, size, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const lap =
        4 * (gray[i] ?? 0) -
        (gray[i - 1] ?? 0) -
        (gray[i + 1] ?? 0) -
        (gray[i - size] ?? 0) -
        (gray[i + size] ?? 0);
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}
