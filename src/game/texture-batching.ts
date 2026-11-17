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

/** Phaser resolves role strings to cyclic RenderNode objects; expose a scalar. */
export function textureBatchName(roles: object | undefined): string | null {
  const role = (roles as Record<string, unknown> | undefined)?.BatchHandler;
  if (typeof role === "string") return role;
  if (role && typeof role === "object" && "name" in role)
    return typeof role.name === "string" ? role.name : null;
  return null;
}
