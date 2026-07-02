import { describe, expect, test } from "bun:test";
import { defineExtension, type HarnessProvider, l10n, params } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const session = { done: Promise.resolve({ status: "completed" as const }), stop: () => {} };

const provider: HarnessProvider = {
  id: "my-agent",
  label: l10n("harness.myAgent", "My Agent"),
  capabilities: () => [],
  start: () => session,
  resume: () => session,
};

const wrap = (name: string, definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

describe("registerProviders", () => {
  test("registers harnesses under the composed extensionId-prefixed id", () => {
    const runtime = normalizeExtensionSources(
      [wrap("my-harness", defineExtension({ harnesses: { myAgent: provider } }))],
      [],
    );

    expect(runtime.harnesses).toHaveLength(1);
    expect(runtime.harnesses[0]).toMatchObject({
      id: "pstdio.my-harness.my-agent",
      localId: "my-agent",
      extensionId: "pstdio.my-harness",
      name: "my-harness",
    });
  });

  test("skips providers missing required lifecycle methods", () => {
    const { resume: _resume, ...withoutResume } = provider;
    const { capabilities: _capabilities, ...withoutCapabilities } = provider;
    const runtime = normalizeExtensionSources(
      [
        wrap(
          "broken-harness",
          defineExtension({
            harnesses: {
              noResume: withoutResume as HarnessProvider,
              noCapabilities: withoutCapabilities as HarnessProvider,
            },
          }),
        ),
      ],
      [],
    );

    expect(runtime.harnesses).toHaveLength(0);
  });

  test("preserves discrete harness params on registered providers", () => {
    const runtime = normalizeExtensionSources(
      [
        wrap(
          "param-harness",
          defineExtension({
            harnesses: {
              myAgent: {
                ...provider,
                params: {
                  mode: params.select({
                    label: "Mode",
                    defaultValue: "agent",
                    options: [
                      { label: "Agent", value: "agent" },
                      { label: "Plan", value: "plan" },
                    ],
                  }),
                  dryRun: params.boolean({ label: "Dry run", defaultValue: false }),
                },
              },
            },
          }),
        ),
      ],
      [],
    );

    expect(runtime.harnesses).toHaveLength(1);
    expect(runtime.harnesses[0]?.provider.params).toMatchObject({
      mode: { type: "select", defaultValue: "agent" },
      dryRun: { type: "boolean", defaultValue: false },
    });
  });

  test("strips harness params that are not select or boolean descriptors", () => {
    const runtime = normalizeExtensionSources(
      [
        wrap(
          "bad-param-harness",
          defineExtension({
            harnesses: {
              myAgent: {
                ...provider,
                params: {
                  mode: params.select({
                    label: "Mode",
                    defaultValue: "agent",
                    options: [
                      { label: "Agent", value: "agent" },
                      { label: "Plan", value: "plan" },
                    ],
                  }),
                  thinkingTokens: params.number({ defaultValue: 4096 }),
                } as unknown as HarnessProvider["params"],
              },
            },
          }),
        ),
      ],
      [],
    );

    expect(runtime.harnesses).toHaveLength(1);
    expect(runtime.harnesses[0]?.provider.params).toMatchObject({
      mode: { type: "select", defaultValue: "agent" },
    });
    expect(runtime.harnesses[0]?.provider.params).not.toHaveProperty("thinkingTokens");
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid_harness_params",
        severity: "error",
        message: expect.stringContaining("only select and boolean"),
      }),
    );
  });

  test("strips select harness params with no options", () => {
    const runtime = normalizeExtensionSources(
      [
        wrap(
          "empty-select-harness",
          defineExtension({
            harnesses: {
              myAgent: {
                ...provider,
                params: {
                  mode: params.select({
                    label: "Mode",
                    options: [],
                  }),
                },
              },
            },
          }),
        ),
      ],
      [],
    );

    expect(runtime.harnesses).toHaveLength(1);
    expect(runtime.harnesses[0]?.provider.params).not.toHaveProperty("mode");
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid_harness_params",
        severity: "error",
        metadata: expect.objectContaining({ param: "mode" }),
      }),
    );
  });
});
