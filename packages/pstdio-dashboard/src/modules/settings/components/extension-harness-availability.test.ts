import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionHarnessRecord } from "@pstdio/sdk/api";
import type { AgentInfo } from "pstdio-api-contracts";
import { unavailableExtensionHarnesses } from "./extension-harness-availability";

const extension = { extensionId: "example.remote", enabled: true };
const harnesses: WorkbenchExtensionHarnessRecord[] = [
  { id: "arbitrary-provider-id", localId: "helper", extensionId: extension.extensionId },
  { id: "other-provider-id", localId: "helper", extensionId: "example.other" },
];
const unavailable: AgentInfo = {
  id: "arbitrary-provider-id",
  name: "Remote helper",
  supportsModels: false,
  capabilities: [],
  availability: { type: "NOT_FOUND", reason: "Connect a machine in this extension's settings." },
};

describe("extension harness availability", () => {
  test("uses declared ownership and keeps the provider's reason", () => {
    const other = { ...unavailable, id: "other-provider-id" };
    expect(unavailableExtensionHarnesses(extension, harnesses, [other, unavailable])).toEqual([unavailable]);
  });

  test("reports an unavailable harness even when another contribution is available", () => {
    const available: AgentInfo = { ...unavailable, id: "ready", availability: { type: "INSTALLED" } };
    const contributions = [...harnesses, { id: available.id, localId: "ready", extensionId: extension.extensionId }];
    expect(unavailableExtensionHarnesses(extension, contributions, [available, unavailable])).toEqual([unavailable]);
  });

  test("does not report disabled extensions or unknown availability as connection failures", () => {
    expect(unavailableExtensionHarnesses({ ...extension, enabled: false }, harnesses, [unavailable])).toEqual([]);
    expect(unavailableExtensionHarnesses(extension, harnesses, undefined)).toEqual([]);
    expect(unavailableExtensionHarnesses(extension, undefined, [unavailable])).toEqual([]);
    expect(unavailableExtensionHarnesses(extension, harnesses, [])).toEqual([]);
  });

  test("available model-free harnesses do not produce a warning", () => {
    const available: AgentInfo = { ...unavailable, availability: { type: "INSTALLED" } };
    expect(unavailableExtensionHarnesses(extension, harnesses, [available])).toEqual([]);
  });
});
