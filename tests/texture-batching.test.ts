import { describe, expect, it, vi } from "vitest";
import { configureTextureBatch } from "../src/game/texture-batching";

describe("texture-only compatibility batching", () => {
  for (const type of ["Image", "Text"]) {
    it(`isolates ${type} through the public render-node role`, () => {
      const setRenderNodeRole = vi.fn();
      configureTextureBatch({ type, setRenderNodeRole });
      expect(setRenderNodeRole).toHaveBeenCalledExactlyOnceWith(
        "BatchHandler",
        "BatchHandlerQuadSingle",
      );
    });
  }
  for (const type of ["Graphics", "Container", "Zone"]) {
    it(`does not split ${type} triangles`, () => {
      const setRenderNodeRole = vi.fn();
      configureTextureBatch({ type, setRenderNodeRole });
      expect(setRenderNodeRole).not.toHaveBeenCalled();
    });
  }
});
