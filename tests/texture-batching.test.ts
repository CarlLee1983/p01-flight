import { describe, expect, it, vi } from "vitest";
import {
  configureTextureBatch,
  textureBatchName,
} from "../src/game/texture-batching";

describe("texture-only compatibility batching", () => {
  it("exposes only a scalar name from Phaser's cyclic resolved node", () => {
    const node: { name: string; manager?: unknown } = {
      name: "BatchHandlerQuadSingle",
    };
    node.manager = { node };
    expect(
      JSON.stringify({ role: textureBatchName({ BatchHandler: node }) }),
    ).toBe('{"role":"BatchHandlerQuadSingle"}');
    expect(textureBatchName(undefined)).toBe(null);
    expect(textureBatchName({ BatchHandler: "BatchHandlerQuad" })).toBe(
      "BatchHandlerQuad",
    );
  });
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
