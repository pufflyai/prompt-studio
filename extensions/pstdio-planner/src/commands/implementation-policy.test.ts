import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import extension from "../../extension";
import { makeCommandArgs } from "./command-context.fixture";
import { implementationPolicyCommand } from "./implementation-policy";

describe("implementation workflow policy", () => {
  test("enables adversarial reviews and draft PRs by default", async () => {
    const settings = Object.fromEntries(
      Object.entries(extension.settings?.properties ?? {}).map(([key, definition]) => [key, definition.default]),
    );
    const result = await implementationPolicyCommand.run(
      ...makeCommandArgs({
        storage: createMemoryStorage(),
        params: {},
        overrides: { settings: { all: async () => settings } },
      }),
    );

    expect(result).toEqual({ adversarialReview: true, openPr: true, defaultTargetBranch: null });
  });

  test.each([
    [false, true],
    [true, false],
    [false, false],
  ])("reads independent choices: review=%s, PR=%s", async (adversarialReview, openPr) => {
    const result = await implementationPolicyCommand.run(
      ...makeCommandArgs({
        storage: createMemoryStorage(),
        params: {},
        overrides: {
          settings: {
            all: async () => ({
              "implementation.adversarialReview": adversarialReview,
              "implementation.openPr": openPr,
            }),
          },
        },
      }),
    );

    expect(result).toEqual({ adversarialReview, openPr, defaultTargetBranch: null });
  });
});
