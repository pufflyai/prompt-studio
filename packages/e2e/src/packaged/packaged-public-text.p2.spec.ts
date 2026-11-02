import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { writePublicTextExtensions } from "../helpers/public-text-extension";
import { verifyPublicTextEditor } from "../helpers/verify-public-text-editor";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

test("installed publishers edit only their owned or selected text through the public browser SDK", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-public-text-")));
  let child: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    const sources = writePublicTextExtensions(root);
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
        defaultExtensions: [
          { source: sources.editor, installName: "public-text-editor" },
          { source: sources.source, installName: "public-text-source" },
        ],
      }),
    });
    child = started.child;
    const folder = join(root, "project");
    mkdirSync(folder);
    const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
    const created = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Public text" }, folder)),
    });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { id: string };
    for (const owner of ["paper.public-text-source", "ink.public-text-editor"]) {
      const response = await fetch(
        `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/${owner}.command.seed/execute`,
        { method: "POST", headers, body: JSON.stringify({ input: {} }) },
      );
      expect(response.ok).toBe(true);
    }

    browser = await chromium.launch({ headless: true, ...PROVISIONED_CHROMIUM });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    const first = await context.newPage();
    await signInBrowser(first, started.descriptor);
    const route = `${started.baseUrl}/projects/${project.id}/extensions`;
    await first.goto(`${route}/ink.public-text-editor/own`);
    const owned = await verifyPublicTextEditor(first, false, "Editor source");
    await owned.fill("Editor source: own edit");
    const physical = (owner: string, name: string) =>
      readFileSync(join(folder, ".pstdio/extension-storage", owner, "documents", name), "utf8");
    await expect.poll(() => physical("ink.public-text-editor", "own.md")).toBe("Editor source: own edit");

    await first.goto(`${route}/paper.public-text-source/shared`);
    const left = await verifyPublicTextEditor(first, true, "Shared source");
    const second = await context.newPage();
    await second.goto(`${route}/paper.public-text-source/shared`);
    const right = await verifyPublicTextEditor(second, true, "Shared source");
    const submissions = Promise.withResolvers<void>();
    let held = 0;
    await context.route("**/text-editing/request", async (route) => {
      if (route.request().postDataJSON()?.request?.operation === "submit" && held < 2) {
        held++;
        await submissions.promise;
      }
      await route.continue();
    });
    try {
      // Hold admission until both presentations author against their common initial history.
      await Promise.all([left.fill("First: Shared source"), right.fill("Shared source: Second")]);
      await expect.poll(() => held).toBe(2);
      await expect(left).toHaveValue("First: Shared source");
      await expect(right).toHaveValue("Shared source: Second");
    } finally {
      submissions.resolve();
    }
    await expect(left).toHaveValue("First: Shared source: Second");
    await expect(right).toHaveValue("First: Shared source: Second");
    await expect.poll(() => physical("paper.public-text-source", "selected.md")).toBe("First: Shared source: Second");
    expect(physical("paper.public-text-source", "private.md")).toBe("Source owner private text");
    expect(physical("ink.public-text-editor", "own.md")).toBe("Editor source: own edit");
    await context.close();
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
