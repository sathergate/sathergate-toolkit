import type { Pipeline, ProcessedImage, ImageFormat, Transform } from "./types.js";

/**
 * Dynamically import sharp so the module can be loaded even when sharp is not
 * installed (pipeline building is pure data). Throws a clear error when sharp
 * is actually needed but missing.
 */
async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch {
    throw new Error(
      "sharp is required for image processing but was not found. Install it with: npm install sharp",
    );
  }
}

/**
 * Apply a single {@link Transform} to a sharp instance.
 */
function applyTransform(image: any, t: Transform): any {
  switch (t.type) {
    case "resize":
      return image.resize(t.width ?? null, t.height ?? null, {
        fit: t.fit ?? "cover",
      });
    case "crop":
      return image.extract({
        top: t.top,
        left: t.left,
        width: t.width,
        height: t.height,
      });
    case "format":
      return image.toFormat(t.format);
    case "quality": {
      // Quality is applied via the current format's options. We call toFormat
      // with the quality option — sharp will use the format already set.
      return image.toFormat(
        (image as any).options?.formatOut ?? "jpeg",
        { quality: t.quality },
      );
    }
    case "blur":
      return image.blur(t.sigma);
    default:
      return image;
  }
}

/**
 * Determine the final output format from the pipeline transforms. Falls back
 * to the input format (via metadata) or "jpeg".
 */
function resolveFormat(pipeline: Pipeline, inputFormat?: string): ImageFormat {
  for (let i = pipeline.length - 1; i >= 0; i--) {
    const t = pipeline[i];
    if (t?.type === "format") return t.format;
  }
  // Map sharp metadata format strings to our ImageFormat union
  const map: Record<string, ImageFormat> = {
    webp: "webp",
    avif: "avif",
    jpeg: "jpeg",
    jpg: "jpeg",
    png: "png",
  };
  return map[inputFormat ?? ""] ?? "jpeg";
}

/**
 * Process an image through a {@link Pipeline} of transforms.
 *
 * @param input - A `Buffer` of image data or an absolute file path.
 * @param pipeline - Ordered array of transforms to apply.
 * @returns The processed image with metadata.
 */
export async function processImage(
  input: Buffer | string,
  pipeline: Pipeline,
): Promise<ProcessedImage> {
  const sharp = await loadSharp();
  let image = sharp(input);

  // Get input metadata so we can fall back on the original format
  const inputMeta = await sharp(input).metadata();

  // Separate quality transforms — they need special handling
  let lastQuality: number | undefined;
  const transforms: Transform[] = [];

  for (const t of pipeline) {
    if (t.type === "quality") {
      lastQuality = t.quality;
    } else {
      transforms.push(t);
    }
  }

  // Apply non-quality transforms
  for (const t of transforms) {
    image = applyTransform(image, t);
  }

  // Resolve final format and apply with quality
  const format = resolveFormat(pipeline, inputMeta.format);
  const formatOptions: Record<string, unknown> = {};
  if (lastQuality !== undefined) {
    formatOptions.quality = lastQuality;
  }
  image = image.toFormat(format, formatOptions);

  const buffer = await image.toBuffer();
  const meta = await sharp(buffer).metadata();

  return {
    buffer,
    format,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    size: buffer.byteLength,
  };
}
