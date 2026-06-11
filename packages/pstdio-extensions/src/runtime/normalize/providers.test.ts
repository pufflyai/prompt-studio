import { describe, expect, test } from "bun:test";
import { defineExtension, type HarnessProvider, l10n } from "@pstdio/sdk/extensions";
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
});
