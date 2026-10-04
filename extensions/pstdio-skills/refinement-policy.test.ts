import { describe, expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "./extension";
import { refinementPolicyCommand } from "./refinement-policy";

describe("ticket refinement policy", () => {
  test("requires UX prototypes by default", async () => {
    const settings = Object.fromEntries(
      Object.entries(extension.settings?.properties ?? {}).map(([key, definition]) => [key, definition.default]),
    );
    const ctx = makeCommandContext({
      storage: createMemoryStorage(),
      params: {},
      overrides: { settings: { all: async () => settings } },
    });
    expect(await refinementPolicyCommand.run(ctx, {})).toEqual({ generateArtifactPrototype: true });
  });

  test("lets a project turn off UX prototypes", async () => {
    const ctx = makeCommandContext({
      storage: createMemoryStorage(),
      params: {},
      overrides: { settings: { all: async () => ({ "refinement.generateArtifactPrototype": false }) } },
    });
    expect(await refinementPolicyCommand.run(ctx, {})).toEqual({ generateArtifactPrototype: false });
  });
});
