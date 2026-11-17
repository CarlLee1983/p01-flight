interface RenderObject {
  type: string;
  setRenderNodeRole?: (role: string, node: string) => unknown;
}

/** Isolate textured quads only; Graphics triangles must retain normal batching. */
export function configureTextureBatch(object: RenderObject) {
  if (object.type === "Image" || object.type === "Text") {
    object.setRenderNodeRole?.("BatchHandler", "BatchHandlerQuadSingle");
  }
}
