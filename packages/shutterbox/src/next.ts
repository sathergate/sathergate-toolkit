import type { Pipeline, ImageFormat, DarkroomConfig } from "./core/types.js";
import { createDarkroom } from "./core/darkroom.js";
import { processImage } from "./core/processor.js";
import { pipeline as createPipeline } from "./core/pipeline.js";

// ---------------------------------------------------------------------------
// createImageHandler — Next.js Route Handler for on-the-fly processing
// ---------------------------------------------------------------------------

/**
 * Options for the image handler.
 */
export interface ImageHandlerOptions {
  /** Maximum allowed width. Prevents abuse. Defaults to 3840. */
  maxWidth?: number;
  /** Maximum allowed height. Defaults to 2160. */
  maxHeight?: number;
  /** Default quality if not specified in query. Defaults to 80. */
  defaultQuality?: number;
  /** Allowed source prefixes / directories. Defaults to allowing everything. */
  allowedSources?: string[];
}

/**
 * Create a Next.js Route Handler that processes images on-the-fly.
 *
 * Query parameters:
 * - `src` — path to source image (required)
 * - `w`  — target width
 * - `h`  — target height
 * - `f`  — output format (webp | avif | jpeg | png)
 * - `q`  — quality 1-100
 * - `blur` — Gaussian blur sigma
 *
 * Usage in `app/api/image/route.ts`:
 * ```ts
 * import { createImageHandler } from "shutterbox/next";
 * import { createDarkroom } from "shutterbox";
 *
 * const darkroom = createDarkroom();
 * export const GET = createImageHandler(darkroom);
 * ```
 */
export function createImageHandler(
  darkroom: ReturnType<typeof createDarkroom>,
  options: ImageHandlerOptions = {},
) {
  const {
    maxWidth = 3840,
    maxHeight = 2160,
    defaultQuality = 80,
    allowedSources,
  } = options;

  return async function GET(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const src = url.searchParams.get("src");

      if (!src) {
        return new Response(JSON.stringify({ error: "Missing ?src parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Security: validate source path
      if (allowedSources && allowedSources.length > 0) {
        const allowed = allowedSources.some((prefix) => src.startsWith(prefix));
        if (!allowed) {
          return new Response(JSON.stringify({ error: "Source not allowed" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Parse query parameters
      const wParam = url.searchParams.get("w");
      const hParam = url.searchParams.get("h");
      const fParam = url.searchParams.get("f") as ImageFormat | null;
      const qParam = url.searchParams.get("q");
      const blurParam = url.searchParams.get("blur");

      // Build pipeline from query params
      const pipe: Pipeline = [];

      if (wParam || hParam) {
        const width = wParam ? Math.min(parseInt(wParam, 10), maxWidth) : undefined;
        const height = hParam ? Math.min(parseInt(hParam, 10), maxHeight) : undefined;
        if (width || height) {
          pipe.push({ type: "resize", width, height });
        }
      }

      if (blurParam) {
        const sigma = parseFloat(blurParam);
        if (sigma > 0) {
          pipe.push({ type: "blur", sigma });
        }
      }

      if (fParam && ["webp", "avif", "jpeg", "png"].includes(fParam)) {
        pipe.push({ type: "format", format: fParam });
      }

      const quality = qParam ? Math.max(1, Math.min(100, parseInt(qParam, 10))) : defaultQuality;
      pipe.push({ type: "quality", quality });

      const result = await darkroom.process(src, pipe);

      const mimeMap: Record<ImageFormat, string> = {
        webp: "image/webp",
        avif: "image/avif",
        jpeg: "image/jpeg",
        png: "image/png",
      };

      return new Response(result.buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": mimeMap[result.format],
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": String(result.size),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

// ---------------------------------------------------------------------------
// optimizeStaticImages — build-time processing for a directory of images
// ---------------------------------------------------------------------------

export interface StaticOptimizeOptions {
  /** Output directory. Defaults to `<dir>/optimized`. */
  outDir?: string;
  /** Formats to generate. Defaults to ["webp", "jpeg"]. */
  formats?: ImageFormat[];
  /** Widths to generate. If omitted, keeps original width. */
  widths?: number[];
  /** Quality. Defaults to 80. */
  quality?: number;
}

/**
 * Process all images in a directory at build time.
 *
 * Scans for `.jpg`, `.jpeg`, `.png`, `.webp` files and generates optimized
 * variants.
 *
 * ```ts
 * import { optimizeStaticImages } from "shutterbox/next";
 * import { createDarkroom } from "shutterbox";
 *
 * await optimizeStaticImages("./public/images", {
 *   formats: ["webp", "avif"],
 *   widths: [640, 1024, 1536],
 *   quality: 80,
 * });
 * ```
 */
export async function optimizeStaticImages(
  dir: string,
  options: StaticOptimizeOptions = {},
): Promise<{ processed: number; skipped: number }> {
  const { readdir, mkdir, writeFile } = await import("node:fs/promises");
  const { join, extname, basename } = await import("node:path");

  const formats = options.formats ?? ["webp", "jpeg"];
  const quality = options.quality ?? 80;
  const outDir = options.outDir ?? join(dir, "optimized");

  await mkdir(outDir, { recursive: true });

  const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && imageExtensions.has(extname(e.name).toLowerCase()))
    .map((e) => e.name);

  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = join(dir, file);
    const name = basename(file, extname(file));

    try {
      const widths = options.widths ?? [undefined]; // undefined = original width

      for (const width of widths) {
        for (const fmt of formats) {
          const pipe: Pipeline = [];
          if (width) {
            pipe.push({ type: "resize", width });
          }
          pipe.push({ type: "format", format: fmt });
          pipe.push({ type: "quality", quality });

          const result = await processImage(filePath, pipe);
          const suffix = width ? `-${width}` : "";
          const outFile = `${name}${suffix}.${fmt}`;
          await writeFile(join(outDir, outFile), result.buffer);
          processed++;
        }
      }
    } catch {
      skipped++;
    }
  }

  return { processed, skipped };
}
