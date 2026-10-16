import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extensionLoadKey } from "pstdio-extensions";
import { loadExtensionSource } from "./extension-runtime";
import { setup } from "./test-utils/webview-failure-fixture";

test("builds installed source when descriptive manifest assets still name a staging directory", async () => {
  const fixture = await setup();
  try {
    await fixture.sources.updateRegistration(fixture.id, {
      manifest_json: {
        name: "lab",
        views: [
          {
            id: "page",
            body: {
              kind: "webview",
              entry: {
                kind: "package-asset",
                path: "./main.ts",
                baseUrl: pathToFileURL(join(fixture.sourcePath, "..", ".extension-install-old", "lab", "extension.ts"))
                  .href,
              },
            },
          },
        ],
      },
    });
    await expect(fixture.manager.ensure(fixture.id)).resolves.toBeUndefined();
    expect(fixture.module()).toContain("original bundle");
    expect(await fixture.error()).toBeNull();
  } finally {
    await fixture.dispose();
  }
});

test("revalidates a loaded graph after its files change without a registered hash change", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    const older = {
      loadKey: extensionLoadKey(fixture.sourcePath),
      loaded: await loadExtensionSource(fixture.sourcePath),
    };
    writeFileSync(join(fixture.sourcePath, "other.ts"), 'console.log("live current graph");');
    const baseUrl = pathToFileURL(join(fixture.sourcePath, "extension.ts")).href;
    writeFileSync(
      join(fixture.sourcePath, "extension.ts"),
      `export default { views: [{ id: "page", title: "Page", body: {kind:"webview",entry:{kind:"package-asset",path:"./other.ts",baseUrl:${JSON.stringify(baseUrl)}}} }] };`,
    );
    await fixture.manager.adopt(fixture.sourcePath, older);
    expect(fixture.module()).toContain("live current graph");
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("an old successful reporter cannot clear a newer same-entry failure after it is verified", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id);
    writeFileSync(fixture.entry, 'console.log("earlier repaired bundle");');
    fixture.pauseReporting();
    const success = fixture.manager.refresh(fixture.sourcePath);
    await fixture.reporting.promise;
    writeFileSync(fixture.entry, "export const broken = ;");
    fixture.release.resolve();
    await fixture.manager.refresh(fixture.sourcePath);
    expect(await fixture.error()).not.toBeNull();
    fixture.releaseReport.resolve();
    await success;
    expect(await fixture.error()).not.toBeNull();
    expect(fixture.state.builds).toBe(3);
  } finally {
    await fixture.dispose();
  }
});
