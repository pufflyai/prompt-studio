import { expect, test } from "bun:test";
import { productionServiceImages } from "./production-service-images";

test("a released execution image cannot replace the account manager image consumed by the relay topology", () => {
  const images = productionServiceImages([
    { service: "relay", image: `sha256:${"a".repeat(64)}` },
    { service: "account-manager", image: `sha256:${"b".repeat(64)}` },
    { service: "device", image: `sha256:${"c".repeat(64)}` },
  ]);
  expect(images.manager).toBe(`sha256:${"b".repeat(64)}`);
  expect(images.device).toBe(`sha256:${"c".repeat(64)}`);
  expect(Object.keys(images).sort()).toEqual(["device", "manager", "relay"]);
});
