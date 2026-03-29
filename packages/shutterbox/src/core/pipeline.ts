import type { Pipeline, Transform, ImageFormat } from "./types.js";

/**
 * Fluent builder for constructing a serializable {@link Pipeline} config.
 *
 * This is pure data — no sharp dependency is needed at definition time.
 *
 * ```ts
 * const cfg = darkroom.pipeline()
 *   .resize({ width: 800 })
 *   .format("webp")
 *   .quality(80)
 *   .blur(5)
 *   .toConfig();
 * ```
 */
export class PipelineBuilder {
  private transforms: Transform[] = [];

  /** Append an arbitrary transform. */
  push(t: Transform): this {
    this.transforms.push(t);
    return this;
  }

  /** Resize the image. */
  resize(opts: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  }): this {
    return this.push({ type: "resize", ...opts });
  }

  /** Crop a region from the image. */
  crop(opts: { top: number; left: number; width: number; height: number }): this {
    return this.push({ type: "crop", ...opts });
  }

  /** Convert to the given format. */
  format(fmt: ImageFormat): this {
    return this.push({ type: "format", format: fmt });
  }

  /** Set output quality (1-100). */
  quality(q: number): this {
    return this.push({ type: "quality", quality: Math.max(1, Math.min(100, q)) });
  }

  /** Apply Gaussian blur with the given sigma. */
  blur(sigma: number): this {
    return this.push({ type: "blur", sigma });
  }

  /** Return the pipeline as a plain, serializable array of transforms. */
  toConfig(): Pipeline {
    return [...this.transforms];
  }
}

/**
 * Create a new {@link PipelineBuilder}.
 */
export function pipeline(): PipelineBuilder {
  return new PipelineBuilder();
}
