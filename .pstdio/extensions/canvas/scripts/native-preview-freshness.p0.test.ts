import { expect, test } from "bun:test";
import { checkNativeBuildFreshness } from "./native-build-freshness";

test("native previews match the component sources, fixtures, and generated files", async () => {
  const { manifest, stale } = await checkNativeBuildFreshness();
  expect(stale).toEqual([]);
  expect(Object.keys(manifest.hashes).length).toBeGreaterThan(340);
  expect(Object.keys(manifest.outputs)).not.toHaveLength(0);
});
