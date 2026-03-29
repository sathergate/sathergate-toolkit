import type {
  DarkroomConfig,
  Pipeline,
  ProcessedImage,
} from "./types.js";
import { PipelineBuilder } from "./pipeline.js";
import { processImage } from "./processor.js";
import {
  generateResponsiveSet,
  type ResponsiveOptions,
} from "./responsive.js";
import type { ResponsiveSet } from "./types.js";
import { generateBlurPlaceholder } from "./blur-hash.js";

export interface Darkroom {
  /** Process a single image through a pipeline. */
  process(input: Buffer | string, pipeline: Pipeline): Promise<ProcessedImage>;
  /** Generate a responsive image set for multiple breakpoints / formats. */
  responsive(input: Buffer | string, options?: ResponsiveOptions): Promise<ResponsiveSet>;
  /** Create a tiny blur placeholder (base64 data URI). */
  placeholder(input: Buffer | string): Promise<string>;
  /** Start building a new pipeline. */
  pipeline(): PipelineBuilder;
  /** Retrieve a pre-defined variant pipeline by name. */
  variant(name: string): Pipeline;
}

/**
 * Create a configured Darkroom instance.
 *
 * ```ts
 * import { createDarkroom } from "shutterbox";
 *
 * const dr = createDarkroom({
 *   breakpoints: [640, 1024, 1536],
 *   variants: {
 *     thumbnail: {
 *       name: "thumbnail",
 *       transforms: [
 *         { type: "resize", width: 200, height: 200, fit: "cover" },
 *         { type: "format", format: "webp" },
 *         { type: "quality", quality: 75 },
 *       ],
 *     },
 *   },
 * });
 * ```
 */
export function createDarkroom(config: DarkroomConfig = {}): Darkroom {
  const { variants = {}, breakpoints } = config;

  return {
    process(input, pipeline) {
      return processImage(input, pipeline);
    },

    responsive(input, options = {}) {
      const merged: ResponsiveOptions = {
        breakpoints: options.breakpoints ?? breakpoints,
        ...options,
      };
      return generateResponsiveSet(input, merged);
    },

    placeholder(input) {
      return generateBlurPlaceholder(input);
    },

    pipeline() {
      return new PipelineBuilder();
    },

    variant(name) {
      const v = variants[name];
      if (!v) {
        throw new Error(
          `Unknown variant "${name}". Available: ${Object.keys(variants).join(", ") || "(none)"}`,
        );
      }
      return [...v.transforms];
    },
  };
}
