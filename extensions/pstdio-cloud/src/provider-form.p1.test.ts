import { expect, test } from "bun:test";
import { providerFormDefaults } from "./provider-form";

test("editing provider configuration retains public settings and starts with an empty token", () => {
  const publicSettings = {
    configured: true as const,
    region: "sfo3",
    size: "s-4vcpu-8gb",
    image: `ghcr.io/pufflyai/prompt-studio/device@sha256:${"b".repeat(64)}`,
  };
  expect(providerFormDefaults(publicSettings)).toEqual({
    region: publicSettings.region,
    size: publicSettings.size,
    image: publicSettings.image,
    token: "",
  });
});
