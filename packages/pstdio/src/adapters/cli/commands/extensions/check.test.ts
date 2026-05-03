import { describe, expect, type Mock, mock, test } from "bun:test";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import { createHandler } from "./check";

const makeResponse = (overrides: Partial<ExtensionsCheckResponse> = {}): ExtensionsCheckResponse => ({
  extensionsRoot: "/tmp/home/extensions",
  extensionsRootExists: true,
  errorCount: 0,
  warningCount: 0,
  extensions: [],
  commands: [],
  middlewares: [],
  hooks: [],
  schedules: [],
  artifactMounts: [],
  menuContributions: [],
  views: [],
  routes: [],
  navigation: [],
  settingsPanels: [],
  templates: [],
  skills: [],
  diagnostics: [],
  ...overrides,
});

const makeDeps = (response: ExtensionsCheckResponse) => {
  const log = mock() as Mock<(msg: string) => void>;
  const exit = mock() as Mock<(code: number) => void>;
  const checkExtensions = mock(async () => response);
  return { log, exit, checkExtensions };
};

describe("extensions check", () => {
  test("prints empty report and exits 0 when no extensions are installed", async () => {
    const deps = makeDeps(makeResponse({ extensionsRootExists: false }));
    const handler = createHandler(deps);

    await handler();

    const printed = (deps.log.mock.calls[0]?.[0] ?? "") as string;
    expect(printed).toContain("Installed extensions: 0");
    expect(printed).toContain("No extensions found in");
    expect(deps.exit).not.toHaveBeenCalled();
  });

  test("prints loaded extension entries with commands and CLI paths", async () => {
    const response = makeResponse({
      extensions: [
        {
          id: "pstdio.extension-lab",
          namespace: "lab",
          displayName: "Extension Lab",
          version: "0.1.0",
          sourcePath: "/tmp/home/extensions/extension-lab/extension.ts",
        },
      ],
      commands: [
        {
          id: "lab.say-hello",
          extensionId: "pstdio.extension-lab",
          namespace: "lab",
          title: "Say hello",
          cliPath: "lab say-hello",
        },
      ],
    });

    const deps = makeDeps(response);
    const handler = createHandler(deps);

    await handler();

    const printed = (deps.log.mock.calls[0]?.[0] ?? "") as string;
    expect(printed).toContain("Extension Lab");
    expect(printed).toContain("CLI: pstdio lab say-hello");
    expect(deps.exit).not.toHaveBeenCalled();
  });

  test("exits with code 1 when error diagnostics are present", async () => {
    const response = makeResponse({
      errorCount: 1,
      diagnostics: [
        {
          code: "duplicate_cli_path",
          severity: "error",
          message: 'CLI path "lab counter bump" is already provided',
        },
      ],
    });
    const deps = makeDeps(response);
    const handler = createHandler(deps);

    await handler();

    expect(deps.exit).toHaveBeenCalledWith(1);
    const printed = (deps.log.mock.calls[0]?.[0] ?? "") as string;
    expect(printed).toContain("duplicate_cli_path");
  });
});
