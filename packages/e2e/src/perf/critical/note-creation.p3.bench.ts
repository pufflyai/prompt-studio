import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import { noteCreationFixture, runScenario } from "pstdio-benchmarks/writer";
import { folderProjectInput } from "../../helpers/folder-project";
import { PROVISIONED_CHROMIUM } from "../../packaged/packaged-chromium";
import { preparePackagedExtensionSource } from "../../packaged/packaged-extension-source";
import {
  runtimeAuthorization,
  signInBrowser,
  startPackagedServe,
  stopProcess,
} from "../../packaged/packaged-serve-helpers";

const repo = resolve(import.meta.dirname, "../../../../..");
const editorSelector =
  '[data-workbench-region="main"] [contenteditable="true"]:not([aria-label="Resource activity"] *)';

const seedNotes = async (project: string) => {
  const documents = join(project, ".pstdio/extension-storage/pstdio.notes/documents");
  const ids = [];
  for (let index = 0; index < noteCreationFixture.notes; index++) {
    const id = `note-${String(index).padStart(3, "0")}`;
    ids.push(id);
    const folder = join(documents, id);
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, "content.md"),
      `---\ntitle: Note ${index}\n---\n\n# Note body ${index}\n\n` +
        noteCreationFixture.paragraph.repeat(noteCreationFixture.paragraphsPerNote),
    );
  }
  await writeFile(join(documents, ".order.json"), JSON.stringify(ids));
  return documents;
};

const prepareClickTiming = async (page: Page) => {
  await page.evaluate(
    ({ editorSelector, typedText }) => {
      document.addEventListener(
        "click",
        () => {
          performance.mark("notes-create-click");
          const waitForText = () => {
            const editor = document.activeElement;
            if (
              !editor?.matches(editorSelector) ||
              editor.textContent !== typedText ||
              !editor.getBoundingClientRect().height
            ) {
              requestAnimationFrame(waitForText);
              return;
            }
            requestAnimationFrame(() => performance.measure("notes-click-to-type", "notes-create-click"));
          };
          requestAnimationFrame(waitForText);
        },
        { capture: true, once: true },
      );
    },
    { editorSelector, typedText: noteCreationFixture.typedText },
  );
};

await runScenario("B9", async (capture) => {
  const home = await mkdtemp(join(tmpdir(), "pstdio-notes-benchmark-"));
  try {
    const project = join(home, "project");
    const documents = await seedNotes(project);
    const source = await preparePackagedExtensionSource(join(home, "source"), join(repo, "extensions/pstdio-notes"), {
      install: true,
      dependencies: "declared",
    });
    const runtime = await startPackagedServe(home, {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "pstdio-notes" }]),
    });
    try {
      const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
      const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Notes benchmark" }, project)),
      });
      assert(created.ok, `Creating the Notes project failed: HTTP ${created.status}`);
      const { id: projectId } = (await created.json()) as { id: string };
      await expect
        .poll(async () => {
          const response = await fetch(`${runtime.baseUrl}/v1/projects/${projectId}/extensions/ui`, { headers });
          if (!response.ok) return false;
          const { views } = (await response.json()) as { views?: { id: string }[] };
          return views?.some(({ id }) => id === "pstdio.notes.view.note-editor");
        })
        .toBe(true);

      const browser = await chromium.launch(PROVISIONED_CHROMIUM);
      try {
        const page = await browser.newPage({ viewport: noteCreationFixture.viewport });
        const notesPage = `/projects/${projectId}/extensions/pstdio.notes/notes`;
        await signInBrowser(page, runtime.descriptor, notesPage);
        const sidebar = page.locator('[data-workbench-region="sidenav"]');
        const notes = sidebar.getByRole("option", { name: "Notes", exact: true });
        const first = sidebar.getByRole("option", { name: "Note 0", exact: true });
        await notes.waitFor({ state: "visible" });
        if ((await notes.getAttribute("aria-expanded")) !== "true" && !(await first.isVisible())) await notes.click();
        await first.waitFor({ state: "visible" });
        await expect(page.locator(editorSelector)).toHaveCount(0);
        await notes.hover();
        const create = sidebar.getByRole("button", { name: "New note", exact: true });
        await create.waitFor({ state: "visible" });
        capture.detail("fixture", {
          notes: noteCreationFixture.notes,
          browser: browser.version(),
          runtimePid: runtime.descriptor.pid,
        });
        const createResponse = page.waitForResponse((response) =>
          new URL(response.url()).pathname.endsWith("/pstdio.notes.command.notes.create/execute"),
        );
        void createResponse.catch(() => {});
        await prepareClickTiming(page);
        await create.click();
        await page.waitForFunction((selector) => {
          const editor = document.activeElement;
          return editor?.matches(selector) && editor.getBoundingClientRect().height > 0 && editor.textContent === "";
        }, editorSelector);
        await page.keyboard.insertText(noteCreationFixture.typedText);
        const elapsed = await page.waitForFunction(
          () => performance.getEntriesByName("notes-click-to-type", "measure")[0]?.duration,
        );
        capture.record("click-to-type", await elapsed.jsonValue());

        const response = await createResponse;
        assert(response.ok(), `New note failed: HTTP ${response.status()}`);
        const { outcome } = (await response.json()) as { outcome?: { status: string; value?: { id: string } } };
        const id = outcome?.value?.id;
        assert(outcome?.status === "success" && id && /^[\da-f-]{36}$/i.test(id), "New note returned no document ID");
        const file = Bun.file(join(documents, id, "content.md"));
        await expect
          .poll(async () =>
            (await file.text().catch(() => "")).trimEnd().endsWith(`\n${noteCreationFixture.typedText}`),
          )
          .toBe(true);
        capture.check("saved-markdown", true);
      } finally {
        await browser.close();
      }
    } finally {
      await stopProcess(runtime.child);
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
