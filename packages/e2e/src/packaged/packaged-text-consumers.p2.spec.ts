import type { ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient, type TextEditingConnection } from "@pstdio/sdk/client";
import { createTextEditingClient, type TextEditingSession } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { installBuiltSdk } from "../helpers/installed-sdk";
import { verifyNativePublicTextEditor } from "../helpers/verify-public-text-editor";
import { stopPendingTestProcesses } from "../scripts/pending-test-processes";
import { type Browser, test as base, chromium, expect } from "../scripts/playwright-test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { buildBinary } from "./packaged-helpers";
import { signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

interface Resources {
  root: string;
  child?: ChildProcess;
  browser?: Browser;
  connections: Set<TextEditingConnection>;
  sessions: Set<TextEditingSession>;
}
const test = base.extend<{ resources: Resources }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependency patterns.
  resources: async ({}, use) => {
    const resources: Resources = {
      root: realpathSync(mkdtempSync(join(tmpdir(), "pstdio-text-consumers-"))),
      connections: new Set(),
      sessions: new Set(),
    };
    const failures: unknown[] = [];
    try {
      await use(resources);
    } catch (error) {
      failures.push(error);
    }
    const settle = async (operations: Promise<unknown>[]) => {
      for (const outcome of await Promise.allSettled(operations))
        if (outcome.status === "rejected") failures.push(outcome.reason);
    };
    // Final teardown must release the process/browser even if graceful transport draining is held.
    await settle([
      ...[...resources.sessions].map((session) => session.close()),
      ...[...resources.connections].map((connection) => connection.disconnect()),
      stopPendingTestProcesses(),
      resources.browser?.close() ?? Promise.resolve(),
      resources.child ? stopProcess(resources.child) : Promise.resolve(),
    ]);
    rmSync(resources.root, { recursive: true, force: true });
    if (failures.length) throw new AggregateError(failures, "Text consumer cleanup failed");
  },
});

test.beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
});

/** Local adoption qualification uses packed output; it cannot qualify unpublished dependency ranges. */
const consumerSources = (root: string) =>
  ["pstdio-notes", "pstdio-planner"].map((name) => {
    const source = join(root, name);
    cpSync(resolve(import.meta.dirname, "../../../../extensions", name), source, {
      recursive: true,
      filter: (path) => !path.split(/[\\/]/).some((part) => ["node_modules", "dist", ".canvas"].includes(part)),
    });
    installBuiltSdk(source);
    return { source, installName: name };
  });

test("Notes and Planner use public native sessions while retaining domain titles and source identity", async ({
  resources,
}) => {
  const defaults = consumerSources(resources.root);
  const started = await startPackagedServe(resources.root, {
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({ defaultExtensions: defaults }),
  });
  resources.child = started.child;
  const client = createClient({ baseUrl: started.baseUrl, token: started.descriptor.token });
  const folder = join(resources.root, "project");
  mkdirSync(folder);
  const project = await client.projects.create(folderProjectInput({ name: "Text consumers" }, folder));
  const command = async <T>(owner: string, id: string, params: Record<string, unknown>) => {
    const result = await client.extensions.execute(`${owner}.command.${id}`, { projectId: project.id, params });
    expect(result.outcome.ok).toBe(true);
    if (!result.outcome.ok) throw new Error(result.outcome.reason);
    return result.outcome.value as T;
  };
  const openPeer = async (fileRendererId: string, resource: { type: string; id: string }) => {
    const connection = await client.textEditing.connect({
      projectId: project.id,
      scope: { kind: "agent", target: { fileRendererId, resource } },
    });
    resources.connections.add(connection);
    const guest = connection.guest();
    const text = createTextEditingClient(guest.host);
    const grant = await text.current();
    expect(grant).toBeDefined();
    const session = await text.open({ grant: grant! });
    resources.sessions.add(session);
    return session;
  };
  resources.browser = await chromium.launch({ headless: true, ...PROVISIONED_CHROMIUM });
  const context = await resources.browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
  });
  const page = await context.newPage();
  await signInBrowser(page, started.descriptor);
  const url = (owner: string, path: string, type: string, id: string) => {
    const target = new URL(`${started.baseUrl}/projects/${project.id}/extensions/${owner}/${path}`);
    target.searchParams.set(
      "resource",
      `pstdio://extension-resource/${type}/${id}?extensionId=${owner}&projectId=${project.id}`,
    );
    return target.href;
  };

  const notes = "pstdio.pstdio-notes";
  const note = await command<{ id: string }>(notes, "notes.create", { title: "Kept note title" });
  const noteFile = join(folder, ".pstdio/extension-storage", notes, "documents", note.id, "content.md");
  const header = readFileSync(noteFile, "utf8");
  await page.goto(url(notes, "notes", "note", note.id));
  const noteEditor = await verifyNativePublicTextEditor(page, "");
  const notePeer = await openPeer(`${notes}.view.note-editor`, { type: "note", id: note.id });
  await noteEditor.fill("Browser note");
  await expect.poll(() => notePeer.getSnapshot().text.toString()).toContain("Browser note");
  notePeer.transact((text) => text.insert(text.length, " Peer note"));
  await notePeer.flush();
  await expect(noteEditor).toContainText("Peer note");
  await expect.poll(() => readFileSync(noteFile, "utf8")).toContain("Peer note");
  expect(readFileSync(noteFile, "utf8").startsWith(header)).toBe(true);
  await command(notes, "notes.rename", { noteId: note.id, title: "Renamed note" });
  await expect.poll(() => notePeer.getSnapshot().text.toString()).toContain("Renamed note");
  notePeer.transact((text) => text.insert(text.length, " After rename"));
  await notePeer.flush();
  await expect(noteEditor).toContainText("After rename");
  await expect.poll(() => readFileSync(noteFile, "utf8")).toContain("After rename");
  await notePeer.close();

  const planner = "pstdio.pstdio-planner";
  const ticket = await command<{ id: string }>(planner, "create-ticket", { title: "Initial ticket" });
  await page.goto(url(planner, "ticket", "ticket", ticket.id));
  const ticketEditor = await verifyNativePublicTextEditor(page, "");
  const ticketPeer = await openPeer(`${planner}.view.ticket-editor`, { type: "ticket", id: ticket.id });
  await ticketEditor.fill("Shared ticket title");
  await expect.poll(() => ticketPeer.getSnapshot().text.toString()).toContain("Shared ticket title");
  ticketPeer.transact((text) => text.insert(text.length, " Peer ticket"));
  await ticketPeer.flush();
  await expect(ticketEditor).toContainText("Peer ticket");
  await expect
    .poll(async () => {
      const current = await command<{ content: string; title: string }>(planner, "get-ticket", { id: ticket.id });
      return current.title === current.content.trim() && current.content.includes("Peer ticket");
    })
    .toBe(true);
  await ticketPeer.close();
});
