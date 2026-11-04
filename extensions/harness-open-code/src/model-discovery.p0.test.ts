import { describe, expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { ctx, serviceOverrides } from "./harness.test-helpers";

const catalog = JSON.stringify({
  location: { directory: "/project" },
  data: [
    { id: "custom", modelID: "upstream/model", providerID: "local", enabled: true, variants: [{ id: "high" }] },
    { id: "plain", providerID: "local", enabled: true, variants: [] },
    { id: "hidden", providerID: "local", enabled: false, variants: [] },
  ],
});

describe("OpenCode model discovery", () => {
  test("lists enabled OpenCode 2 models with their native thinking choices", async () => {
    const harness = createOpencodeHarness({}, serviceOverrides());
    const context: HarnessContext = {
      ...ctx,
      process: {
        ...ctx.process,
        run: async ({ command }) => {
          if (command[1] === "--version") return { exitCode: 0, stdout: "opencode v2.2.5\n", stderr: "" };
          if (command.slice(1).join(" ") === "api GET /api/model --standalone")
            return { exitCode: 0, stdout: catalog, stderr: "" };
          return { exitCode: 1, stdout: "", stderr: "Unrecognized flag: --verbose in command opencode models" };
        },
      },
    };

    expect(await harness.listModels!(context)).toEqual([
      {
        id: "local/custom",
        label: "local/custom",
        paramOverrides: {
          variant: {
            type: "select",
            label: "Thinking",
            defaultValue: "high",
            options: [{ label: "High", value: "high", icon: "level-high" }],
          },
        },
      },
      { id: "local/plain", label: "local/plain", paramOverrides: { variant: null } },
    ]);
  });

  test("recovers on the next discovery after a command failure without logging credentials", async () => {
    let requests = 0;
    const warnings: string[] = [];
    const harness = createOpencodeHarness({ detect: async () => ({ available: true }) }, serviceOverrides());
    const context: HarnessContext = {
      ...ctx,
      logger: { ...ctx.logger, warn: (message) => void warnings.push(message) },
      process: {
        ...ctx.process,
        run: async () => {
          requests += 1;
          return requests === 1
            ? { exitCode: 1, stdout: "", stderr: "secret-provider-key" }
            : { exitCode: 0, stdout: "local/recovered\n", stderr: "" };
        },
      },
    };

    expect(await harness.listModels!(context)).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("OpenCode model discovery failed");
    expect(warnings[0]).not.toContain("secret-provider-key");
    expect(await harness.listModels!(context)).toEqual([{ id: "local/recovered" }]);
  });

  test("does not expose native catalog content from a malformed response", async () => {
    const warnings: string[] = [];
    const harness = createOpencodeHarness(
      { detect: async () => ({ available: true }), getModelsOutput: async () => '{"settings":"https://secret' },
      serviceOverrides(),
    );
    const context = { ...ctx, logger: { ...ctx.logger, warn: (message: string) => void warnings.push(message) } };

    expect(await harness.listModels!(context)).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toContain("secret");
  });
});
