import { describe, it, expect } from "vitest";
import { pipeline, PipelineBuilder } from "../core/pipeline.js";

describe("PipelineBuilder", () => {
  it("creates an empty pipeline", () => {
    const p = pipeline().toConfig();
    expect(p).toEqual([]);
  });

  it("chains resize transforms", () => {
    const p = pipeline()
      .resize({ width: 800, height: 600, fit: "cover" })
      .toConfig();

    expect(p).toEqual([
      { type: "resize", width: 800, height: 600, fit: "cover" },
    ]);
  });

  it("chains crop transforms", () => {
    const p = pipeline()
      .crop({ top: 10, left: 20, width: 100, height: 100 })
      .toConfig();

    expect(p).toEqual([
      { type: "crop", top: 10, left: 20, width: 100, height: 100 },
    ]);
  });

  it("chains format transforms", () => {
    const p = pipeline().format("webp").toConfig();
    expect(p).toEqual([{ type: "format", format: "webp" }]);
  });

  it("supports all image formats", () => {
    for (const fmt of ["webp", "avif", "jpeg", "png"] as const) {
      const p = pipeline().format(fmt).toConfig();
      expect(p[0]).toEqual({ type: "format", format: fmt });
    }
  });

  it("chains quality transforms and clamps to 1-100", () => {
    expect(pipeline().quality(80).toConfig()).toEqual([
      { type: "quality", quality: 80 },
    ]);
    // Clamp low
    expect(pipeline().quality(-5).toConfig()).toEqual([
      { type: "quality", quality: 1 },
    ]);
    // Clamp high
    expect(pipeline().quality(200).toConfig()).toEqual([
      { type: "quality", quality: 100 },
    ]);
  });

  it("chains blur transforms", () => {
    const p = pipeline().blur(5).toConfig();
    expect(p).toEqual([{ type: "blur", sigma: 5 }]);
  });

  it("chains multiple transforms in order", () => {
    const p = pipeline()
      .resize({ width: 1200 })
      .format("webp")
      .quality(85)
      .blur(2)
      .toConfig();

    expect(p).toHaveLength(4);
    expect(p[0].type).toBe("resize");
    expect(p[1].type).toBe("format");
    expect(p[2].type).toBe("quality");
    expect(p[3].type).toBe("blur");
  });

  it("supports push for arbitrary transforms", () => {
    const p = pipeline()
      .push({ type: "resize", width: 400 })
      .push({ type: "format", format: "png" })
      .toConfig();

    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ type: "resize", width: 400 });
    expect(p[1]).toEqual({ type: "format", format: "png" });
  });

  it("returns a plain array (serializable)", () => {
    const p = pipeline().resize({ width: 500 }).format("jpeg").toConfig();

    // Should be a plain array, not a class instance
    expect(Array.isArray(p)).toBe(true);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });

  it("does not mutate the builder on toConfig", () => {
    const builder = pipeline().resize({ width: 800 });
    const config1 = builder.toConfig();
    builder.format("webp");
    const config2 = builder.toConfig();

    expect(config1).toHaveLength(1);
    expect(config2).toHaveLength(2);
  });

  it("returns this for fluent chaining", () => {
    const builder = pipeline();
    expect(builder.resize({ width: 100 })).toBe(builder);
    expect(builder.crop({ top: 0, left: 0, width: 50, height: 50 })).toBe(builder);
    expect(builder.format("webp")).toBe(builder);
    expect(builder.quality(80)).toBe(builder);
    expect(builder.blur(3)).toBe(builder);
    expect(builder.push({ type: "blur", sigma: 1 })).toBe(builder);
  });
});
