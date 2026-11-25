import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createExtensionProbe } from "../../../test-utils/extension-probe";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { installExtensionSource } from "../../extensions/install-extension-source";

// The harness runs in its extension worker, so it reaches the test through a probe.
const probe = createExtensionProbe();

let tempRoot: string;
let previousDefaultExtensions: string | undefined;
let previousPstdioHome: string | undefined;

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-agent-listing-install-"));
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
});

afterAll(() => {
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  rmSync(tempRoot, { recursive: true, force: true });
  probe.stop();
});

const packageJson = (name: string) =>
  JSON.stringify({
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    type: "module",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  });

// The first availability probe waits for the test, so an install can land while the listing runs.
const writeHarnessExtension = (root: string) => {
  const sourcePath = join(root, "listed-harness");
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(join(sourcePath, "package.json"), packageJson("listed-harness"));
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `const run = () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} });
export default {
  harnesses: [{
    id: "listed",
    ref: { kind: "harness", id: "listed" },
    label: "Listed",
    capabilities: () => [],
    detect: async () => {
      ${probe.call('{ kind: "detect" }')};
      return { available: true };
    },
    start: run,
    resume: run,
    dispose: () => void ${probe.request('{ kind: "dispose" }')},
  }],
};
`,
  );
  return sourcePath;
};

const uploadExtension = (name: string) => {
  const body = new FormData();
  body.append("kind", "upload");
  body.append("installName", name);
  body.append("folderName", name);
  body.append("skipInstall", "true");
  body.append("files", new File([packageJson(name)], "package.json"));
  body.append("files", new File(["export default {};\n"], "extension.ts"));
  return body;
};

test("lists an unchanged harness while another extension installs", async () => {
  await installExtensionSource({ source: writeHarnessExtension(join(tempRoot, "sources")), skipInstall: true });
  let releaseGate = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const entered = Promise.withResolvers<void>();
  const detectEntered = entered.promise;
  let detects = 0;
  const released: string[] = [];
  probe.answer(async (value) => {
    const kind = (value as { kind?: string } | null)?.kind;
    if (kind === "dispose") released.push("listed");
    if (kind === "detect" && ++detects === 1) {
      entered.resolve();
      await gate;
    }
    return null;
  });
  const { app, close } = await createTestApp({ storageRoot: join(tempRoot, "storage") });

  try {
    const project = (await (
      await app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Listing" })),
      })
    ).json()) as { id: string };

    const listing = app.request("/v1/agents/info");
    await detectEntered;

    const installed = await app.request(`/v1/projects/${project.id}/extensions/install`, {
      method: "POST",
      body: uploadExtension("unrelated-tool"),
    });
    expect(installed.status, JSON.stringify(await installed.clone().json())).toBe(201);
    // A listing that starts after the install sees the new extension set.
    expect((await app.request("/v1/agents/info")).status).toBe(200);
    releaseGate();

    const response = await listing;
    expect(await response.json()).toEqual([
      expect.objectContaining({ id: "pstdio.listed-harness.harness.listed", availability: { type: "INSTALLED" } }),
    ]);
    expect(response.status).toBe(200);
    expect(released).toEqual([]);
  } finally {
    releaseGate();
    await close();
  }
});
