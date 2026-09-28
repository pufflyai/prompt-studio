import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { chromium, expect } from "@playwright/test";
import { gt, valid } from "semver";
import { openPackagedProject } from "../src/e2e/packaged-project-helpers";
import { prepareDesktopReleaseArtifacts } from "../src/release/release-artifacts";
import { validateSidecarArtifact } from "../src/runtime/sidecar-artifact";

if (process.platform !== "win32" || !process.env.CI) {
  throw new Error("Installation verification requires a disposable Windows CI runner");
}
const execute = promisify(execFile);
const evidence = resolve(import.meta.dirname, "../test-results/windows-installation");
mkdirSync(evidence, { recursive: true });
const home = mkdtempSync(join(tmpdir(), "pstdio-installed-"));
const env: NodeJS.ProcessEnv = { ...process.env, PSTDIO_HOME: home, PSTDIO_LOG_PATH: join(home, "logs.jsonl") };
delete env.ELECTRON_RUN_AS_NODE;
const installRoot = join(process.env.LOCALAPPDATA!, "PromptStudio");
assert(!existsSync(installRoot), "The runner must not have an existing Prompt Studio installation");
const updater = join(installRoot, "Update.exe");
const launcher = join(installRoot, "Prompt Studio.exe");

const run = async (file: string, args: string[]) => {
  const { stdout } = await execute(file, args, { env, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return stdout.trim();
};
const powershell = (script: string) => run("pwsh", ["-NoProfile", "-NonInteractive", "-Command", script]);
const oneFile = (root: string, pattern: string) => {
  const paths = [...new Bun.Glob(pattern).scanSync({ cwd: root, absolute: true })];
  assert.equal(paths.length, 1, `Expected one ${pattern} under ${root}`);
  return paths[0]!;
};
const readCandidate = (directory: string) => {
  const root = resolve(directory);
  const packagePath = oneFile(root, "**/*-full.nupkg");
  const version = basename(packagePath).match(/^PromptStudio-(.+)-full\.nupkg$/)?.[1];
  assert(version && valid(version), `Unexpected update package: ${packagePath}`);
  return { root, version, packagePath, setup: oneFile(root, "**/*Setup.exe"), releases: oneFile(root, "**/RELEASES") };
};
const baseline = readCandidate(process.argv[2]!);
const candidate = readCandidate(process.argv[3]!);
assert(gt(candidate.version, baseline.version), "The candidate must be newer than the installed baseline");

const signatures = async (paths: string[], name: string) => {
  env.PSTDIO_SIGNATURE_PATHS = JSON.stringify(paths);
  const result = JSON.parse(
    await powershell(`
    $ErrorActionPreference = 'Stop'
    $results = foreach ($path in ($env:PSTDIO_SIGNATURE_PATHS | ConvertFrom-Json)) {
      $signature = Get-AuthenticodeSignature -LiteralPath $path
      if ($signature.Status -ne 'Valid') { throw "Invalid signature: $path" }
      if ($signature.SignerCertificate.Subject -notmatch 'CN=Pufflig AB,') { throw "Unexpected publisher: $path" }
      if (-not $signature.TimeStamperCertificate) { throw "Missing timestamp: $path" }
      @{ path = $path; subject = $signature.SignerCertificate.Subject; status = $signature.Status.ToString(); timestampSubject = $signature.TimeStamperCertificate.Subject }
    }
    $results | ConvertTo-Json
  `),
  );
  writeFileSync(join(evidence, `${name}-signatures.json`), `${JSON.stringify(result, null, 2)}\n`);
};
const installedFiles = (version: string) => {
  const root = join(installRoot, `app-${version}`);
  return { root, executable: join(root, "Prompt Studio.exe"), sidecar: join(root, "resources/bin/pstdio.exe") };
};
const verifyInstalled = async (version: string, stage: string) => {
  const files = installedFiles(version);
  await signatures([files.executable, files.sidecar, updater, launcher], stage);
  await validateSidecarArtifact({
    resourcesPath: join(files.root, "resources"),
    platform: "win32",
    arch: "x64",
    appVersion: version,
  });
  assert.equal(await run(files.sidecar, ["--version"]), version);
  return files;
};

const launchInstalled = async (version: string) => {
  // Use Squirrel's normal launcher so the installed version, not an archive, is selected.
  const reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = reservation.port;
  await reservation.stop(true);
  await new Promise<void>((resolveLaunch, rejectLaunch) => {
    const child = spawn(
      launcher,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${join(home, "electron-user-data")}`],
      { env, stdio: "ignore" },
    );
    child.once("error", rejectLaunch);
    child.once("exit", (code) => {
      if (code === 0) resolveLaunch();
      else rejectLaunch(new Error(`Installed launcher exited with ${code}`));
    });
  });
  await expect
    .poll(
      async () =>
        fetch(`http://127.0.0.1:${port}/json/version`)
          .then((r) => r.ok)
          .catch(() => false),
      { timeout: 10_000 },
    )
    .toBe(true);
  const descriptorPath = join(home, "runtime.json");
  await expect.poll(() => existsSync(descriptorPath), { timeout: 10_000 }).toBe(true);
  // Read only the runtime's public discovery file. No database access is used.
  const runtime = JSON.parse(readFileSync(descriptorPath, "utf8")) as { origin: string; appVersion: string };
  assert.equal(runtime.appVersion, version);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  await expect
    .poll(
      () =>
        browser
          .contexts()[0]
          ?.pages()
          .some((page) => page.url().startsWith(runtime.origin)),
      { timeout: 10_000 },
    )
    .toBe(true);
  const page = browser
    .contexts()[0]!
    .pages()
    .find((item) => item.url().startsWith(runtime.origin))!;
  await expect(page.locator("#root")).not.toBeEmpty();
  const processes = JSON.parse(
    await powershell(`
    Get-CimInstance Win32_Process -Filter "Name='Prompt Studio.exe'" |
      Select-Object ProcessId, ExecutablePath | ConvertTo-Json -AsArray
  `),
  ) as Array<{ ProcessId: number; ExecutablePath: string }>;
  assert(
    processes.some((item) => item.ExecutablePath.toLowerCase() === installedFiles(version).executable.toLowerCase()),
  );
  const info = await page.evaluate(() => window.promptStudioDesktop.getAppInfo());
  assert.equal(info.version, version);
  return { browser, page, runtime, pids: processes.map((item) => item.ProcessId) };
};
const closeInstalled = async (app: Awaited<ReturnType<typeof launchInstalled>>) => {
  await app.page.evaluate(() => void window.promptStudioDesktop.quitApp());
  await expect.poll(() => existsSync(join(home, "runtime.json")), { timeout: 10_000 }).toBe(false);
  await expect
    .poll(
      async () => {
        const remaining = await powershell(
          `@(Get-Process -Id ${app.pids.join(",")} -ErrorAction SilentlyContinue).Count`,
        );
        return Number(remaining);
      },
      { timeout: 10_000 },
    )
    .toBe(0);
  await app.browser.close().catch(() => {});
};

const requests: string[] = [];
const feedRoot = `/pufflyai/prompt-studio/releases/download/pstdio@${candidate.version}`;
const feedFiles = new Map([
  [`${feedRoot}/RELEASES`, candidate.releases],
  [`${feedRoot}/${basename(candidate.packagePath)}`, candidate.packagePath],
]);
const feed = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    requests.push(path);
    const file = feedFiles.get(path);
    return file ? new Response(Bun.file(file)) : new Response("Not found", { status: 404 });
  },
});
const feedUrl = `http://127.0.0.1:${feed.port}${feedRoot}`;
let active: Awaited<ReturnType<typeof launchInstalled>> | undefined;
try {
  await signatures([baseline.setup, candidate.setup], "installers");
  await run(baseline.setup, ["--silent"]);
  const files = await verifyInstalled(baseline.version, "baseline");
  const shortcuts = await powershell(`
    $shell = New-Object -ComObject WScript.Shell
    Get-ChildItem ([Environment]::GetFolderPath('Programs')) -Recurse -Filter '*.lnk' |
      ForEach-Object { $link = $shell.CreateShortcut($_.FullName); if ($link.TargetPath -eq '${launcher.replaceAll("'", "''")}') {
        @{ path = $_.FullName; target = $link.TargetPath; arguments = $link.Arguments }
      }} | ConvertTo-Json -AsArray
  `);
  assert(shortcuts.includes("Prompt Studio.exe"), "Start menu shortcut must launch the installed app");
  writeFileSync(join(evidence, "shortcuts.json"), `${shortcuts}\n`);
  active = await launchInstalled(baseline.version);
  const projectPath = join(home, "Windows installed project");
  mkdirSync(projectPath);
  const project = await active.page.evaluate(async (path) => {
    const response = await fetch("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path } } }),
    });
    if (!response.ok) throw new Error(`Project creation failed: ${response.status}`);
    return (await response.json()) as { id: string; name: string; extension_warnings?: unknown[] };
  }, projectPath);
  assert.deepEqual(project.extension_warnings ?? [], []);
  await openPackagedProject(active.page, project);
  await active.page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(active.page.getByLabel("Main").getByText("No active conversations", { exact: true })).toBeVisible();
  writeFileSync(join(projectPath, "persisted.txt"), "Signed Windows update preservation\n");
  assert((await run(files.sidecar, ["projects", "list"])).includes(project.id));
  await active.page.screenshot({ path: join(evidence, "baseline-workbench.png") });
  await closeInstalled(active);
  active = undefined;
  const check = await run(updater, ["--checkForUpdate", feedUrl]);
  writeFileSync(join(evidence, "update-check.txt"), check);
  const available = JSON.parse(check.split(/\r?\n/).at(-1)!) as { releasesToApply: Array<{ version: string }> };
  assert(available.releasesToApply.some((release) => release.version === candidate.version));
  writeFileSync(join(evidence, "update.txt"), await run(updater, ["--update", feedUrl]));
  const updated = await verifyInstalled(candidate.version, "updated");
  active = await launchInstalled(candidate.version);
  const projects = (await active.page.evaluate(async () => (await fetch("/v1/projects")).json())) as Array<{
    id: string;
    name: string;
  }>;
  assert(projects.some((item) => item.id === project.id && item.name === project.name));
  await openPackagedProject(active.page, project);
  await expect(active.page.getByLabel("Main").getByText("No active conversations", { exact: true })).toBeVisible();
  assert.equal(readFileSync(join(projectPath, "persisted.txt"), "utf8"), "Signed Windows update preservation\n");
  assert((await run(updated.sidecar, ["projects", "list"])).includes(project.id));
  await active.page.screenshot({ path: join(evidence, "updated-workbench.png") });
  await closeInstalled(active);
  active = undefined;
  const current = JSON.parse((await run(updater, ["--checkForUpdate", feedUrl])).split(/\r?\n/).at(-1)!);
  assert.deepEqual(current.releasesToApply, []);
  assert(requests.includes(`${feedRoot}/${basename(candidate.packagePath)}`));
  const desktopRoot = resolve(import.meta.dirname, "..");
  assert.equal(JSON.parse(readFileSync(join(desktopRoot, "package.json"), "utf8")).version, candidate.version);
  cpSync(candidate.root, join(desktopRoot, "out/make"), { recursive: true });
  cpSync(join(updated.root, "resources/bin"), join(desktopRoot, ".sidecar/bin"), { recursive: true });
  const prepared = prepareDesktopReleaseArtifacts({
    desktopRoot,
    runtimePackagePath: resolve(desktopRoot, "../../packages/pstdio/package.json"),
    target: "win32-x64",
    releaseNotes: "Signed Windows installation and update candidate.",
    publishedAt: new Date().toISOString(),
  });
  cpSync(prepared.manifestPath, join(evidence, basename(prepared.manifestPath)));
  cpSync(prepared.checksumsPath, join(evidence, basename(prepared.checksumsPath)));
  writeFileSync(
    join(evidence, "result.json"),
    `${JSON.stringify(
      {
        baseline: baseline.version,
        candidate: candidate.version,
        projectId: project.id,
        requests,
        installedUpdater: updater,
        status: "passed",
        publicAppUpdateCheck: "not tested: candidates are unpublished",
        operatingSystem: await powershell(
          "Get-CimInstance Win32_OperatingSystem | Select-Object Caption, OSArchitecture | ConvertTo-Json",
        ),
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    "Signed Setup installation, native Squirrel update, installed signatures, and project preservation passed.",
  );
} finally {
  if (active) await closeInstalled(active).catch(() => {});
  // Only this disposable installation and its isolated runtime belong to this check.
  for (const version of [candidate.version, baseline.version]) {
    const sidecar = installedFiles(version).sidecar;
    if (existsSync(sidecar)) await run(sidecar, ["close"]).catch(() => {});
  }
  await feed.stop(true);
  for (const log of [
    join(installRoot, "SquirrelSetup.log"),
    join(process.env.LOCALAPPDATA!, "SquirrelTemp/SquirrelSetup.log"),
  ]) {
    if (existsSync(log)) writeFileSync(join(evidence, `${basename(dirname(log))}-setup.log`), readFileSync(log));
  }
}
