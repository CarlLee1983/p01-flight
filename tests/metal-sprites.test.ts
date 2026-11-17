import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { METAL_SPRITES, readMetalSpriteStatus } from "../src/game/metal-sprites";
import { createRaiderTextures } from "../src/game/raider-art";
import { createCannonTextures } from "../src/game/cannon-art";
import { createEnemyModuleTextures } from "../src/game/enemy-modules-art";
import report from "../docs/metal-sprite-import.json";
it("shipping bitmap files match the reviewed alpha WebP import and combat display resolution", () => {
  expect(METAL_SPRITES).toHaveLength(7);
  for (const sprite of METAL_SPRITES) {
    const bytes=readFileSync(`public/${sprite.path}`);
    const imported=report.find(a=>a.key===sprite.file)!;
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(imported.sha256);
    expect(bytes.toString("ascii",12,16)).toBe("VP8X");
    expect(bytes[20] & 0x10).toBe(0x10); // actual alpha channel
    expect([bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1]).toEqual([sprite.width,sprite.height]);
  }
});
it("preloaded hulls and intact/broken pods are never replaced by flat canvas fallback", () => {
  const keys=new Set([...METAL_SPRITES.map(a=>a.key),"boss-support"]);
  let allocations=0;
  const scene:any={textures:{exists:(k:string)=>keys.has(k),createCanvas:()=>{allocations++;throw new Error("preloaded sprite was overwritten");}}};
  createRaiderTextures(scene);createCannonTextures(scene);createEnemyModuleTextures(scene);
  expect(allocations).toBe(0);
});

it("pre-boot diagnostics stay readable before even the missing texture exists", () => {
  const pending=readMetalSpriteStatus({exists:()=>false,get:()=>{throw new Error("get must not be called before ready");}});
  expect(pending).toHaveLength(7);
  expect(pending.every(a=>!a.ready && !a.bitmap)).toBe(true);
  expect(readMetalSpriteStatus({exists:()=>true,get:()=>undefined}).every(a=>!a.bitmap)).toBe(true);
});
it("bitmap readiness distinguishes loaded image sources from canvas fallback", () => {
  const bitmap={kind:"bitmap"};
  const loaded=readMetalSpriteStatus({exists:()=>true,get:()=>({source:[{image:bitmap}]})},image=>image===bitmap);
  expect(loaded.every(a=>a.ready && a.bitmap)).toBe(true);
  const canvas=readMetalSpriteStatus({exists:()=>true,get:()=>({source:[{image:{kind:"canvas"}}]})},image=>image===bitmap);
  expect(canvas.every(a=>a.ready && !a.bitmap)).toBe(true);
});
