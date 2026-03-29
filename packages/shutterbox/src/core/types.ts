// ---------------------------------------------------------------------------
// Image formats
// ---------------------------------------------------------------------------

export type ImageFormat = "webp" | "avif" | "jpeg" | "png";

// ---------------------------------------------------------------------------
// Transform operations
// ---------------------------------------------------------------------------

export interface Resize {
  type: "resize";
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export interface Crop {
  type: "crop";
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Format {
  type: "format";
  format: ImageFormat;
}

export interface Quality {
  type: "quality";
  quality: number; // 1-100
}

export interface Blur {
  type: "blur";
  sigma: number;
}

export type Transform = Resize | Crop | Format | Quality | Blur;

// ---------------------------------------------------------------------------
// Pipeline — ordered sequence of transforms (pure data, serializable)
// ---------------------------------------------------------------------------

export type Pipeline = Transform[];

// ---------------------------------------------------------------------------
// Variants & configuration
// ---------------------------------------------------------------------------

export interface ImageVariant {
  name: string;
  transforms: Pipeline;
  suffix?: string;
}

export interface DarkroomConfig {
  /** Named sets of transforms that can be referenced by name. */
  variants?: Record<string, ImageVariant>;
  /** Directory used for on-disk caching. Defaults to `.shutterbox-cache/`. */
  cacheDir?: string;
  /** Breakpoint widths used for responsive image generation. */
  breakpoints?: number[];
}

// ---------------------------------------------------------------------------
// Processing results
// ---------------------------------------------------------------------------

export interface ProcessedImage {
  buffer: Buffer;
  format: ImageFormat;
  width: number;
  height: number;
  /** Size of the buffer in bytes. */
  size: number;
}

export interface ResponsiveSource {
  format: ImageFormat;
  srcset: string;
  type: string;
}

export interface ResponsiveSet {
  /** Combined srcset string (widths). */
  srcset: string;
  /** Suggested `sizes` attribute value. */
  sizes: string;
  /** Per-format sources for use inside a <picture> element. */
  sources: ResponsiveSource[];
  /** The individual processed images keyed by `{width}_{format}`. */
  images: Map<string, ProcessedImage>;
}
