import { describe, expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "../../extension";
import { refinementPolicyCommand } from "./refinement-policy";

describe("ticket refinement policy", () => {
  test("requires canvas designs by default", async () => {
    const settings = Object.fromEntries(
      Object.entries(extension.settings?.properties ?? {}).map(([key, definition]) => [key, definition.default]),
    );
    const ctx = makeCommandContext({
      storage: createMemoryStorage(),
      params: {},
      overrides: { settings: { all: async () => settings } },
    });
    expect(await refinementPolicyCommand.run(ctx, {})).toEqual({ updateCanvasDesign: true });
  });

  test("lets a project turn off canvas designs", async () => {
    const ctx = makeCommandContext({
      storage: createMemoryStorage(),
      params: {},
      overrides: { settings: { all: async () => ({ "refinement.updateCanvasDesign": false }) } },
    });
    expect(await refinementPolicyCommand.run(ctx, {})).toEqual({ updateCanvasDesign: false });
  });
});
