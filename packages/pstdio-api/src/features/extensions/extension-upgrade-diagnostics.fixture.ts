import { deepStrictEqual, strictEqual } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { closeBackendWorkers } from "pstdio-extensions";
import { createTestApp } from "../../test-utils/create-test-app";
import { writeExtension } from "./default-extensions-test-fixtures";
import { packagedExtensionCatalog } from "./extension-catalog";
import { installExtensionSource, toExtensionEnableInput } from "./install-extension-source";

const performanceEntry = packagedExtensionCatalog.extensions.find(
  (entry) => entry.extensionId === "pstdio.performance",
)!;
const installName = "renamed-performance";

const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
    cwd,
    env: process.env,
  });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
};

const commitCapture = async (repo: string, extensionPath: string, release: string) => {
  await writeFile(
    join(extensionPath, "extension.ts"),
    `export default { commands: [{
      id: "capture", ref: { kind: "command", id: "capture" }, title: "Capture",
      async run(ctx) {
        const status = await ctx.diagnostics.capture({ kind: "cpu", durationMs: 20 })
          .then(() => "captured", (error) => error.code ?? error.message);
        return { release: ${JSON.stringify(release)}, status };
      },
    }] };`,
  );
  git(repo, "add", ".");
  git(repo, "commit", "-m", release);
  return git(repo, "rev-parse", "HEAD");
};

const upgradeRenamedInstall = async (root: string, source: string) => {
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    const origin = {
      ...performanceEntry.origin,
      url: source === "foreign-catalog" ? "https://extensions.example.test/repo" : performanceEntry.origin.url,
    };
    if (source === "foreign-catalog") {
      process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
      await writeFile(
        process.env.PSTDIO_EXTENSION_CATALOG,
        JSON.stringify({ version: 1, extensions: [{ ...performanceEntry, origin }] }),
      );
    }

    const repo = join(root, "repo");
    const extensionPath = join(repo, origin.path);
    writeExtension(extensionPath, "performance");
    git(repo, "init");
    git(repo, "config", "uploadpack.allowFilter", "true");
    // Redirect fixture fetches while preserving the recorded catalog URL and the real Git install path.
    git(repo, "config", "--file", join(root, "gitconfig"), `url.${pathToFileURL(repo).href}.insteadOf`, origin.url);
    const oldCommit = await commitCapture(repo, extensionPath, "old");
    const newCommit = await commitCapture(repo, extensionPath, "new");
    handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(root, "storage"),
      release: { source: "git", ref: newCommit },
    });
    const { app, deps } = handle;
    const project = await deps.projectService.create({ name: "Diagnostics upgrade" });
    const projectPath = join(root, "project");
    await mkdir(projectPath);
    await deps.workspaceService.ensureDefault({ project_id: project.id, root_path: projectPath, name: "Project" });

    const installed = await installExtensionSource({
      source: performanceEntry.installName,
      installName,
      hostReleaseRef: source === "arbitrary-ref" ? newCommit : oldCommit,
      originSource: { kind: "git", origin },
      ref: oldCommit,
      skipInstall: true,
    });
    // Both commits have identical dependency inputs, so the upgrade can reuse the empty dependency directory.
    await mkdir(join(installed.targetPath, "node_modules"));
    const enabled = await deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      installName,
      ...toExtensionEnableInput(installed),
    });
    const base = `/v1/projects/${project.id}/extensions`;
    const capture = async () => {
      const response = await app.request(`${base}/commands/pstdio.performance.command.capture/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params: {} }),
      });
      const { outcome } = await response.json();
      strictEqual(outcome.ok, true, JSON.stringify(outcome));
      return outcome.value;
    };
    const before = await capture();
    const upgrade = await app.request(`${base}/${enabled.instance.id}/upgrade`, { method: "POST" });
    const upgradeResult = await upgrade.json();
    strictEqual(upgrade.status, 200, JSON.stringify(upgradeResult));
    deepStrictEqual(
      {
        changed: upgradeResult.changed,
        id: upgradeResult.extension.id,
        installName: upgradeResult.extension.installName,
      },
      {
        changed: true,
        id: enabled.instance.id,
        installName,
      },
    );
    const current = await deps.extensionService.getProjectExtensionInstance(project.id, enabled.instance.id);
    strictEqual(current?.installedSource.source_ref, `${origin.url}@${newCommit}#${origin.path}`);
    return { before, after: await capture() };
  } finally {
    await handle?.close();
    await closeBackendWorkers();
  }
};

const [root, source] = process.argv.slice(2);
deepStrictEqual(await upgradeRenamedInstall(root!, source!), {
  before: { release: "old", status: source === "host-release" ? "captured" : "diagnostics_forbidden" },
  after: { release: "new", status: source === "foreign-catalog" ? "diagnostics_forbidden" : "captured" },
});
