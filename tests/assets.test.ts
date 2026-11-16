import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const assets = JSON.parse(readFileSync("docs/asset-sources.json", "utf8"));
test("all selected CC0 PNG assets match pinned hashes and retain transparency", () => {
  expect(assets).toHaveLength(4);
  for (const asset of assets) {
    const file = readFileSync(asset.file);
    expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(createHash("sha256").update(file).digest("hex")).toBe(asset.sha256);
    expect(file.readUInt32BE(16)).toBeGreaterThan(0);
    expect(file.readUInt32BE(20)).toBeGreaterThan(0);
    expect(
      file.includes(Buffer.from("tRNS")) || [4, 6].includes(file[25]),
    ).toBe(true);
    expect(asset.source).toContain("3694c6879e487c108f55677be7dd2ca75b07cc3b");
  }
});
