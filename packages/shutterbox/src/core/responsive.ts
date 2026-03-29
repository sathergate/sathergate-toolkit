import type { ImageFormat, Pipeline, ProcessedImage, ResponsiveSet, ResponsiveSource } from "./types.js";
import { processImage } from "./processor.js";

/** Run async tasks with a concurrency limit. */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;

  async function worker(): Promise<void> {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]!();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/** Default breakpoints if none are provided. */
const DEFAULT_BREAKPOINTS = [640, 768, 1024, 1280, 1536];

/** Default output formats: modern + fallback. */
const DEFAULT_FORMATS: ImageFormat[] = ["webp", "jpeg"];

export interface ResponsiveOptions {
  /** Widths to generate. Defaults to common breakpoints. */
  breakpoints?: number[];
  /** Formats to generate for each breakpoint. Defaults to webp + jpeg. */
  formats?: ImageFormat[];
  /** Quality for all generated images. Defaults to 80. */
  quality?: number;
  /** Additional transforms to apply before resizing. */
  basePipeline?: Pipeline;
  /** A function that returns the public URL for a processed image. */
  urlFor?: (width: number, format: ImageFormat) => string;
}

/**
 * Generate a full responsive image set from a single source image.
 *
 * Produces one image per breakpoint per format, and assembles the `srcset`,
 * `sizes`, and per-format `<source>` data needed for a `<picture>` element.
 */
export async function generateResponsiveSet(
  input: Buffer | string,
  options: ResponsiveOptions = {},
): Promise<ResponsiveSet> {
  const breakpoints = options.breakpoints ?? DEFAULT_BREAKPOINTS;
  const formats = options.formats ?? DEFAULT_FORMATS;
  const quality = options.quality ?? 80;
  const basePipeline = options.basePipeline ?? [];
  const urlFor = options.urlFor ?? ((w, f) => `image-${w}.${f}`);

  const images = new Map<string, ProcessedImage>();
  const sourcesByFormat = new Map<ImageFormat, string[]>();

  // Process every breakpoint x format combination with bounded concurrency
  const taskFns: (() => Promise<void>)[] = [];

  for (const fmt of formats) {
    sourcesByFormat.set(fmt, []);
    for (const width of breakpoints) {
      const pipeline: Pipeline = [
        ...basePipeline,
        { type: "resize", width },
        { type: "format", format: fmt },
        { type: "quality", quality },
      ];

      taskFns.push(async () => {
        const result = await processImage(input, pipeline);
        const key = `${width}_${fmt}`;
        images.set(key, result);
        const url = urlFor(width, fmt);
        sourcesByFormat.get(fmt)!.push(`${url} ${width}w`);
      });
    }
  }

  await runWithConcurrency(taskFns, 3);

  // Sort srcset entries by width
  for (const entries of sourcesByFormat.values()) {
    entries.sort((a, b) => {
      const wa = parseInt(a.split(" ").pop()!, 10);
      const wb = parseInt(b.split(" ").pop()!, 10);
      return wa - wb;
    });
  }

  // Build per-format sources
  const mimeMap: Record<ImageFormat, string> = {
    webp: "image/webp",
    avif: "image/avif",
    jpeg: "image/jpeg",
    png: "image/png",
  };

  const sources: ResponsiveSource[] = formats.map((fmt) => ({
    format: fmt,
    srcset: sourcesByFormat.get(fmt)!.join(", "),
    type: mimeMap[fmt],
  }));

  // Build default sizes attribute
  const sorted = [...breakpoints].sort((a, b) => a - b);
  const sizesParts = sorted.map((bp) => `(max-width: ${bp}px) ${bp}px`);
  sizesParts.push(`${sorted[sorted.length - 1]}px`);

  // Fallback srcset uses the last format (usually jpeg)
  const fallbackFormat = formats[formats.length - 1]!;
  const fallbackSrcset = sourcesByFormat.get(fallbackFormat)!.join(", ");

  return {
    srcset: fallbackSrcset,
    sizes: sizesParts.join(", "),
    sources,
    images,
  };
}
