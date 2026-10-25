import { expect, test } from "bun:test";
import { portableSmokeImages } from "./portable-smoke-images";

test("artifact smoke uses immutable loaded image IDs and never rebuilds their runtime services", () => {
  const images = { relay: `sha256:${"a".repeat(64)}`, manager: `sha256:${"b".repeat(64)}` };
  const plan = portableSmokeImages("fixture", images);
  expect(plan.images).toEqual(images);
  expect(plan.buildServices).toEqual(["tls", "initialize", "smoke"]);
  expect(plan.prebuilt).toBe(true);
  expect(() => portableSmokeImages("fixture", { ...images, relay: "untrusted:mutable-tag" })).toThrow("immutable");
});
test("the source smoke still builds its own runtime and fixture images", () => {
  expect(portableSmokeImages("fixture").buildServices).toEqual(["relay", "manager", "tls", "initialize", "smoke"]);
});
