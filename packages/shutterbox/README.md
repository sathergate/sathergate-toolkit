# shutterbox

Image processing pipeline for Next.js.

Complements `next/image` with processing capabilities: resize, crop, format conversion, responsive sets, and blur placeholders. Built for AI coding agent ergonomics with a fluent, serializable pipeline API.

## Install

```bash
npm install shutterbox sharp
```

`sharp` is a peer dependency used for actual image processing. The pipeline builder and types work without it.

## Quick Start

```ts
import { createDarkroom } from "shutterbox";

const darkroom = createDarkroom();

// Build a pipeline (pure data, no sharp needed)
const pipe = darkroom.pipeline()
  .resize({ width: 800 })
  .format("webp")
  .quality(80)
  .toConfig();

// Process an image
const result = await darkroom.process("./photo.jpg", pipe);
// result.buffer, result.format, result.width, result.height, result.size
```

## Pipeline API

The fluent builder produces a serializable array of transforms. No sharp dependency at definition time.

```ts
import { pipeline } from "shutterbox";

const config = pipeline()
  .resize({ width: 1200, height: 630, fit: "cover" })
  .crop({ top: 0, left: 0, width: 1200, height: 630 })
  .format("avif")
  .quality(75)
  .blur(2)
  .toConfig();

// config is a plain array — JSON-serializable, storable, transferable
console.log(JSON.stringify(config));
```

### Available Transforms

| Method | Description |
|--------|-------------|
| `.resize({ width?, height?, fit? })` | Resize. Fit: `cover`, `contain`, `fill`, `inside`, `outside` |
| `.crop({ top, left, width, height })` | Extract a region |
| `.format(fmt)` | Convert to `webp`, `avif`, `jpeg`, or `png` |
| `.quality(n)` | Set quality 1-100 |
| `.blur(sigma)` | Gaussian blur |

## Variants

Pre-define named transform sets in your config:

```ts
const darkroom = createDarkroom({
  variants: {
    thumbnail: {
      name: "thumbnail",
      transforms: [
        { type: "resize", width: 200, height: 200, fit: "cover" },
        { type: "format", format: "webp" },
        { type: "quality", quality: 75 },
      ],
    },
    hero: {
      name: "hero",
      transforms: [
        { type: "resize", width: 1920 },
        { type: "format", format: "avif" },
        { type: "quality", quality: 80 },
      ],
    },
  },
});

const pipe = darkroom.variant("thumbnail");
const result = await darkroom.process("./photo.jpg", pipe);
```

## Responsive Images

Generate multiple sizes and formats for `<picture>` elements:

```ts
const responsive = await darkroom.responsive("./hero.jpg", {
  breakpoints: [640, 1024, 1536],
  formats: ["webp", "jpeg"],
  quality: 80,
  urlFor: (width, format) => `/images/hero-${width}.${format}`,
});

// responsive.srcset  — "hero-640.jpeg 640w, hero-1024.jpeg 1024w, ..."
// responsive.sizes   — "(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1536px"
// responsive.sources — [{ format: "webp", srcset: "...", type: "image/webp" }, ...]
```

## Blur Placeholders

Create tiny blurred placeholder images for progressive loading:

```ts
const placeholder = await darkroom.placeholder("./photo.jpg");
// "data:image/png;base64,..."
```

## React Components

```tsx
import { Picture, BlurImage, DarkroomProvider, useDarkroom } from "shutterbox/react";

// Wrap your app with DarkroomProvider for useDarkroom() access
<DarkroomProvider darkroom={darkroom}>
  <App />
</DarkroomProvider>

// Responsive <picture> from a ResponsiveSet
<Picture src={responsiveSet} alt="Hero image" />

// Blur-up placeholder animation
<BlurImage
  src="/images/photo.jpg"
  placeholder={blurDataUrl}
  alt="Photo"
  transitionMs={500}
/>
```

## Next.js Image Handler

Create an API route that processes images on-the-fly:

```ts
// app/api/image/route.ts
import { createImageHandler } from "shutterbox/next";
import { createDarkroom } from "shutterbox";

const darkroom = createDarkroom();
export const GET = createImageHandler(darkroom, {
  maxWidth: 3840,
  defaultQuality: 80,
});
```

Then use query parameters:

```
/api/image?src=./public/photo.jpg&w=800&f=webp&q=80
```

### Build-Time Optimization

Process all images in a directory during your build:

```ts
import { optimizeStaticImages } from "shutterbox/next";

await optimizeStaticImages("./public/images", {
  formats: ["webp", "avif"],
  widths: [640, 1024, 1536],
  quality: 80,
  outDir: "./public/images/optimized",
});
```

## License

MIT

## Part of sathergate-toolkit

This package is part of the [sathergate-toolkit](https://github.com/sathergate/sathergate-toolkit) — an agent-native infrastructure toolkit for Next.js. All packages work independently or together.

### See Also
- **flagpost** — Feature flags with percentage rollouts (`npm i flagpost`)
- **ratelimit-next** — Rate limiting with sliding window & token bucket (`npm i ratelimit-next`)
- **notifykit** — Unified notifications via Twilio, Resend, SNS (`npm i notifykit`)
- **croncall** — Serverless-native cron job scheduling (`npm i croncall`)
- **vaultbox** — AES-256-GCM encrypted secrets management (`npm i vaultbox`)
- **searchcraft** — Full-text search with BM25 scoring (`npm i searchcraft`)
- **gatehouse** — Drop-in RBAC for Next.js with role hierarchy (`npm i gatehouse`)
