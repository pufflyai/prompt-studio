import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Page } from "@playwright/test";
import { launchMemoryDesktop, memoryRequest, prepareMemoryExtensions, readMemoryRuntime } from "./desktop-memory-app";
import { sampleDesktopMemory } from "./desktop-memory-samples";

// A diagnostic rather than a test: the mandated ten-minute workload has its own fixed duration.
// Run with the production desktop executable and matching packaged sidecar already built.
const executable = process.env.PSTDIO_DESKTOP_EXECUTABLE;
const sidecar = process.env.E2E_PACKAGED_BINARY_PATH;
if (process.platform !== "darwin" || !executable || !sidecar || !process.argv[2])
  throw new Error("Set PSTDIO_DESKTOP_EXECUTABLE and E2E_PACKAGED_BINARY_PATH; pass an output directory on macOS");
const output = resolve(process.argv[2]);
mkdirSync(output, { recursive: true });
const home = join(output, "app-home");
const controller = new AbortController();
const interrupt = () => controller.abort(new Error("Memory qualification interrupted"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, interrupt);
const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const resources = resolve(dirname(executable), "../Resources");
const bundledSidecar = join(resources, "bin/pstdio");
const metadata: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirtySource: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).length > 0,
  executable,
  sidecar,
  executableSha256: hash(executable),
  sidecarSha256: hash(sidecar),
  appAsarSha256: hash(join(resources, "app.asar")),
  bundledSidecarSha256: hash(bundledSidecar),
  hardware: {
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryBytes: totalmem(),
    macOS: release(),
    power: execFileSync("pmset", ["-g", "custom"], { encoding: "utf8" }),
  },
  referenceLimitation: totalmem() < 32 * 1024 ** 3 ? "This machine has less RAM than the 32 GiB M5 reference" : null,
  workload:
    "Default extensions plus Workspaces and deterministic harness; 100 completed messages, one file, one idle terminal; 30-second settle then 40 fixed 15-second open/close cycles",
  samplingIntervalMs: 500,
  budgetBytes: 2_000_000_000,
};
let desktop: Awaited<ReturnType<typeof launchMemoryDesktop>> | undefined;
let sampler: ReturnType<typeof sampleDesktopMemory> | undefined;
let page: Page | undefined;
let desktopPid = 0;
const wait = async (predicate: () => Promise<boolean>, description: string) => {
  const deadline = performance.now() + 30_000;
  while (!(await predicate())) {
    controller.signal.throwIfAborted();
    if (performance.now() >= deadline) throw new Error(`Timed out waiting for ${description}`);
    await Bun.sleep(100);
  }
};
const navigate = async (page: Page, path: string) => {
  await page.evaluate((path) => {
    history.pushState(null, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
};
try {
  const profile = await prepareMemoryExtensions(join(output, "public-extensions"), controller.signal);
  metadata.defaultExtensions = profile.defaults;
  metadata.installedExtensions = profile.sources.map((entry) => entry.installName);
  sampler = sampleDesktopMemory(
    sidecar,
    () => [desktopPid, readMemoryRuntime(home)?.pid ?? 0].filter(Boolean),
    join(output, "samples.jsonl"),
  );
  desktop = await launchMemoryDesktop(executable, home, profile.sources, controller.signal, (pid) => {
    desktopPid = pid;
  });
  const { runtime, browser } = desktop;
  const runtimeExecutable = execFileSync("ps", ["-p", String(runtime.pid), "-o", "comm="], { encoding: "utf8" }).trim();
  metadata.runtimeExecutable = runtimeExecutable;
  if (runtimeExecutable !== bundledSidecar || metadata.bundledSidecarSha256 !== metadata.sidecarSha256)
    throw new Error("The observed runtime does not match the packaged sidecar");
  await wait(async () => {
    page = browser
      .contexts()[0]
      ?.pages()
      .find((candidate) => candidate.url().startsWith(runtime.origin));
    return Boolean(page);
  }, "workbench page");
  const activePage = page!;
  await activePage.addInitScript(() => {
    if (window === window.top) localStorage.setItem("onboarding-complete", "true");
  });
  const projectPath = join(home, "memory-project");
  mkdirSync(projectPath);
  writeFileSync(join(projectPath, "memory.ts"), "export const memoryWorkload = true;\n".repeat(100));
  const project = await memoryRequest(runtime, "/projects", {
    name: "Memory qualification",
    initial_workspace: { provider_id: "pstdio.root", params: { path: projectPath } },
  });
  if (project.extension_warnings?.length) throw new Error("Default extension setup returned warnings");
  const session = await memoryRequest(runtime, "/sessions", {
    project_id: project.id,
    title: "Memory conversation",
    agent: "pstdio.workbench-fixture.harness.fake",
  });
  for (let index = 0; index < 50; index++) {
    await memoryRequest(runtime, `/sessions/${session.id}/follow-up`, {
      prompt: `Message ${index + 1}: ${"Read the workspace and explain the change. ".repeat(20)}`,
    });
    await wait(
      async () => (await memoryRequest(runtime, `/sessions/${session.id}`)).status === "completed",
      "completed conversation turn",
    );
  }
  const conversation = await memoryRequest(runtime, `/sessions/${session.id}/conversation`);
  if (conversation.messages.length !== 100)
    throw new Error(`Expected 100 messages, received ${conversation.messages.length}`);
  metadata.messages = conversation.messages.length;
  await activePage.goto(`${runtime.origin}/projects/${project.id}/sessions`);
  const openConversation = async () => {
    await navigate(activePage, `/projects/${project.id}/sessions`);
    await activePage.getByRole("option", { name: "Memory conversation", exact: true }).click();
    await activePage.locator('[data-testid="content-editable"][contenteditable="true"]:visible').waitFor();
  };
  await openConversation();
  const showBottom = activePage.getByRole("button", { name: "Show Bottom Panel", exact: true });
  if (await showBottom.isVisible()) await showBottom.click();
  await activePage
    .locator('[data-workbench-panel-header="secondary"]')
    .getByRole("button", { name: "Add panel", exact: true })
    .click();
  await activePage.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  const terminal = activePage.getByRole("textbox", { name: "Terminal input" });
  await terminal.waitFor();
  await terminal.fill("printf '__memory_idle__\\n'");
  await terminal.press("Enter");
  await wait(
    async () => (await activePage.locator(".xterm:visible .xterm-rows").innerText()).includes("__memory_idle__"),
    "idle terminal",
  );
  await navigate(activePage, `/projects/${project.id}/workspaces`);
  const workspace = (await memoryRequest(runtime, `/workspaces?project_id=${project.id}`))[0];
  await activePage
    .getByRole("region", { name: "Main", exact: true })
    .getByRole("option")
    .filter({ hasText: workspace.workspace_shorthand })
    .click();
  const files = activePage.getByRole("region", { name: "Files", exact: true });
  await files.getByRole("option", { name: "memory.ts", exact: true }).click();
  await activePage.locator(".monaco-editor:visible").waitFor();
  const filePath = new URL(activePage.url()).pathname + new URL(activePage.url()).search;
  const closeConversation = () => navigate(activePage, `/projects/${project.id}/sessions`);
  const openFile = async () => {
    await navigate(activePage, filePath);
    await activePage.locator(".monaco-editor:visible").waitFor();
  };
  metadata.filePath = filePath;
  sampler.phase("settle");
  await Bun.sleep(30_000);
  sampler.phase("measure");
  const measuredAt = performance.now();
  for (let cycle = 0; cycle < 40; cycle++) {
    controller.signal.throwIfAborted();
    await openConversation();
    await Bun.sleep(3_000);
    await closeConversation();
    await openFile();
    await Bun.sleep(3_000);
    // Files is a page within the workspace; close its document through the supported breadcrumb navigation.
    await navigate(activePage, filePath.replace(/[?&]document=[^&]*/, ""));
    const hide = activePage.getByRole("button", { name: "Hide Bottom Panel", exact: true });
    if (await hide.isVisible()) await hide.click();
    await Bun.sleep(3_000);
    if (await showBottom.isVisible()) await showBottom.click();
    await Bun.sleep(Math.max(0, measuredAt + (cycle + 1) * 15_000 - performance.now()));
    metadata.cycles = cycle + 1;
    console.log(JSON.stringify({ cycle: cycle + 1, elapsedMs: performance.now() - measuredAt }));
  }
  sampler.phase("after");
  await Bun.sleep(500);
  metadata.memory = await sampler.close();
  sampler = undefined;
  metadata.completed = true;
} catch (error) {
  metadata.completed = false;
  metadata.error = error instanceof Error ? error.stack : String(error);
  if (page && !page.isClosed()) {
    writeFileSync(
      join(output, "failure-page.txt"),
      await page
        .locator("body")
        .innerText()
        .catch(() => "Unavailable"),
    );
    await page.screenshot({ path: join(output, "failure.png") }).catch(() => {});
  }
  throw error;
} finally {
  try {
    if (sampler) metadata.memory = await sampler.close();
  } finally {
    await desktop?.close();
    writeFileSync(join(output, "qualification.json"), `${JSON.stringify(metadata, null, 2)}\n`);
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, interrupt);
  }
}
console.log(JSON.stringify(metadata, null, 2));
