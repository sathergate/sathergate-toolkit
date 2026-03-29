/**
 * Generate a tiny blurred placeholder image and return it as a base64 data URI.
 *
 * The result is suitable for use as the `blurDataURL` prop in `next/image` or
 * the `<BlurImage>` component shipped with this library.
 */
export async function generateBlurPlaceholder(
  input: Buffer | string,
  size: number = 8,
): Promise<string> {
  let sharp: any;
  try {
    const mod = await import("sharp");
    sharp = mod.default ?? mod;
  } catch {
    throw new Error(
      "sharp is required for blur placeholder generation but was not found. Install it with: npm install sharp",
    );
  }

  const buffer: Buffer = await sharp(input)
    .resize(size, size, { fit: "inside" })
    .blur(1.5)
    .png({ quality: 20 })
    .toBuffer();

  const base64 = buffer.toString("base64");
  return `data:image/png;base64,${base64}`;
}
