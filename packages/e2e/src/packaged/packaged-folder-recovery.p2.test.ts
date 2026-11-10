import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ProjectFolderRecoveryStatus,
  type ProjectFolderSource,
  projectFolderRecoveryStatusSchema,
} from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { runTestCommand } from "../scripts/run-test-command";
import {
  gitOutput,
  listedCopy,
  ownCopy,
  signInDevice,
  snapshotTree,
  startFolderDevice,
  waitFor,
  waitForValue,
  writeCertificate,
} from "./packaged-folder-recovery.fixture";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { createPackagedSyncPeer, packagedAccountCode } from "./packaged-sync-relay.fixture";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const secret = "FOLDER_RECOVERY_PRIVATE_TOKEN=7f3c9a";
const privateName = "private-plan-ps1069.md";
const secondSecret = "SECOND_ACCOUNT_PRIVATE_TOKEN=c41d";

const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    stdout: "ignore",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
};

/**
 * A project folder with saved and unsaved Git work, hidden and ignored files, metadata and
 * dependency folders. `hookMarker` is written only if something runs the repository's hooks.
 */
const writeSourceFolder = async (folder: string, hookMarker: string) => {
  await mkdir(join(folder, "src"), { recursive: true });
  await writeFile(join(folder, "README.md"), "# Recovered without a Git host\n");
  await writeFile(join(folder, "src/app.ts"), "export const version = 1;\n");
  await writeFile(join(folder, ".gitignore"), ".env\nbuild/\n");
  // Only a folder with a root `.pstignore` is copied, and `.gitignore` does not apply to it.
  await writeFile(join(folder, ".pstignore"), "node_modules/\n");
  git(folder, "init", "-q", "-b", "main");
  git(folder, "config", "user.name", "Folder Owner");
  git(folder, "config", "user.email", "owner@example.test");
  git(folder, "add", ".");
  git(folder, "commit", "-qm", "first");
  git(folder, "checkout", "-qb", "topic");
  await writeFile(join(folder, "src/topic.ts"), "export const topic = true;\n");
  git(folder, "add", ".");
  git(folder, "commit", "-qm", "unpushed topic work");
  git(folder, "checkout", "-q", "main");
  await writeFile(join(folder, "src/app.ts"), "export const version = 2;\n");
  git(folder, "commit", "-qam", "second, never pushed");
  // Staged, unstaged and untracked work that no Git host has.
  await writeFile(join(folder, "src/staged.ts"), "export const staged = true;\n");
  git(folder, "add", "src/staged.ts");
  await writeFile(join(folder, "src/app.ts"), "export const version = 3; // saved, not staged\n");
  await mkdir(join(folder, "notes"));
  await writeFile(join(folder, "notes", privateName), "saved without a commit\n");
  await writeFile(join(folder, ".env"), `${secret}\n`);
  await mkdir(join(folder, ".hidden"));
  await writeFile(join(folder, ".hidden/settings.json"), '{"hidden":true}\n');
  await mkdir(join(folder, "build"));
  await writeFile(join(folder, "build/output.txt"), "Git ignores this; .pstignore does not\n");
  await mkdir(join(folder, "data"));
  // Large enough to span many 1 MiB chunks, so its download can be interrupted part way.
  await writeFile(join(folder, "data/model.bin"), randomBytes(24 * 1024 * 1024));
  await mkdir(join(folder, "bin"));
  await writeFile(join(folder, "bin/run.sh"), "#!/bin/sh\necho run\n");
  await chmod(join(folder, "bin/run.sh"), 0o755);
  await writeFile(join(folder, "read-only.txt"), "read only\n");
  await chmod(join(folder, "read-only.txt"), 0o444);
  await mkdir(join(folder, "empty"));
  await symlink("../outside/target.txt", join(folder, "outside-link"));
  await symlink("src/app.ts", join(folder, "app-link"));
  for (const dependency of ["node_modules/left-pad", "packages/web/node_modules/react"]) {
    await mkdir(join(folder, dependency), { recursive: true });
    await writeFile(join(folder, dependency, "index.js"), "module.exports = 'dependency';\n");
  }
  await writeFile(join(folder, ".git/hooks/post-checkout"), `#!/bin/sh\necho ran > "${hookMarker}"\n`);
  await chmod(join(folder, ".git/hooks/post-checkout"), 0o755);
};

const isDependency = (path: string) => path === "node_modules" || path.endsWith("/node_modules");

const gitState = (folder: string) => ({
  head: gitOutput(folder, "rev-parse", "HEAD"),
  branches: gitOutput(folder, "for-each-ref", "--format=%(refname) %(objectname)"),
  log: gitOutput(folder, "log", "--all", "--format=%H %P %s"),
  reflog: gitOutput(folder, "reflog", "--format=%H %gs"),
  status: gitOutput(folder, "status", "--porcelain=v1", "--untracked-files=all"),
  staged: gitOutput(folder, "diff", "--cached"),
  unstaged: gitOutput(folder, "diff"),
  config: gitOutput(folder, "config", "--local", "--get", "user.email"),
});

setupPackagedSmokeTests();
// Folder recovery supports macOS and Linux (ADR 0138); Windows reports `unsupported`.
test.skipIf(process.platform === "win32")(
  "a second computer restores a project folder with its Git work while the first is off, and another account stays separate",
  async () => {
    const startedAt = Date.now();
    const phase = (name: string) => logTestPhase(`Folder recovery: ${name} (+${Date.now() - startedAt}ms)`);
    const root = await realpath(await mkdtemp(join(tmpdir(), "packaged-folder-recovery-")));
    const tls = writeCertificate(root);
    const peer = createPackagedSyncPeer({ key: Bun.file(tls.key), cert: Bun.file(tls.cert) });
    const env = { NODE_EXTRA_CA_CERTS: tls.cert };
    const folder = join(root, "laptop-project");
    const hookMarker = join(root, "hook-ran");
    const started = await Promise.allSettled([
      startFolderDevice(join(root, "laptop"), env),
      startFolderDevice(join(root, "desktop"), env),
      startFolderDevice(join(root, "other-account"), env),
      writeSourceFolder(folder, hookMarker),
    ]);
    const [laptop, desktop, other] = started.map((result) =>
      result.status === "fulfilled" && result.value ? result.value : undefined,
    );
    try {
      for (const result of started) if (result.status === "rejected") throw result.reason;
      if (!laptop || !desktop || !other) throw new Error("A device did not start");
      phase("three devices started");

      // The laptop and another account's computer both capture and upload their folders.
      const project = await laptop.client.projects.create(folderProjectInput({ name: "Recovered folder" }, folder));
      const laptopDevice = await signInDevice(laptop, peer.origin);
      // Until the laptop is off, no other device can read folder bytes from Cloud.
      peer.failBlobReads((device) => device !== laptopDevice);
      await laptop.client.account.syncProject(project.id);
      const otherFolder = join(root, "other-project");
      await mkdir(otherFolder);
      await writeFile(join(otherFolder, ".env"), `${secondSecret}\n`);
      await writeFile(join(otherFolder, ".pstignore"), "");
      const otherProject = await other.client.projects.create(
        folderProjectInput({ name: "Another account" }, otherFolder),
      );
      await signInDevice(other, peer.origin, packagedAccountCode("second"));
      await other.client.account.syncProject(otherProject.id);
      let laptopCopy = await waitForValue(() => ownCopy(laptop, project.id));
      phase("laptop copy captured and uploaded");

      // The desktop learns about the copy, then the laptop turns off before any folder byte downloads.
      const desktopDevice = await signInDevice(desktop, peer.origin);
      await waitFor(async () => !!(await desktop.client.projects.get(project.id).catch(() => null)));
      const attempted = new Set<string>();
      peer.failBlobReads((device) => {
        if (device !== laptopDevice) attempted.add(device);
        return device !== laptopDevice;
      });
      await waitFor(() => attempted.has(desktopDevice));
      laptopCopy = await waitForValue(() => ownCopy(laptop, project.id));
      await stopProcess(laptop.host.child);
      phase("laptop stopped before the desktop downloaded");

      // The download is interrupted part way, then resumes without reading finished chunks again.
      const desktopReads = () => peer.blobReads().filter((read) => read.deviceId === desktopDevice);
      // The copy holds over 100 chunks and the project's records need few blobs, so this is part way
      // through the folder download.
      const interruptAfter = 40;
      let failedReads = 0;
      peer.failBlobReads((device) => {
        const fail = device === desktopDevice && desktopReads().length >= interruptAfter;
        if (fail) failedReads++;
        return fail;
      });
      await desktop.client.account.retryProjectSync(project.id);
      await waitFor(() => failedReads > 0);
      expect((await listedCopy(desktop, project.id, laptopDevice))?.available ?? false).toBe(false);
      // HTTP response delivery precedes client verification and atomic retention.
      // Retry may cancel that unfinished response; only retained chunks are finished work.
      const retained = new Set(
        [...new Bun.Glob("**/*.blob").scanSync(join(desktop.home, "storage/folder-recovery/chunks"))].map(
          (path) => `~${path.split(/[\\/]/).at(-1)!.slice(0, -".blob".length)}`,
        ),
      );
      expect(retained.size).toBeGreaterThan(0);
      const resumedAt = desktopReads().length;
      peer.failBlobReads(() => false);
      await desktop.client.account.retryProjectSync(project.id);
      const listed = await waitForValue(
        () => listedCopy(desktop, project.id, laptopDevice),
        (copy) => !!copy?.available,
      );
      const reads = desktopReads().map((read) => read.blobId);
      expect(reads.length).toBeGreaterThan(2 * interruptAfter);
      expect(reads.slice(resumedAt).filter((id) => retained.has(id))).toEqual([]);
      phase(`desktop downloaded ${reads.length} blobs after an interruption`);
      expect(listed).toMatchObject({
        current: false,
        folder,
        completedAt: laptopCopy.completedAt,
        policy: "node_modules/\n",
        git: "functional",
        files: laptopCopy.files,
        bytes: laptopCopy.bytes,
      });

      // The CLI lists the same copy and restores it into a new folder; it becomes the project's folder.
      const cli = (args: string[], expectedStatus = 0) =>
        runTestCommand(
          PACKAGED_BINARY_PATH,
          ["projects", "folder", ...args],
          {
            cwd: root,
            env: { ...process.env, PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_HOME: desktop.home },
          },
          expectedStatus,
        );
      const cliSources = JSON.parse((await cli(["sources", project.id])).stdout) as ProjectFolderSource[];
      expect(cliSources).toContainEqual(listed);
      const source = ["--device", laptopDevice, "--source", listed.sourceId];
      const restored = join(root, "desktop-project");
      const result = JSON.parse(
        (await cli(["restore", project.id, ...source, "--path", "desktop-project"])).stdout,
      ) as ProjectFolderRecoveryStatus;
      expect(result.restore).toMatchObject({
        state: "complete",
        error: null,
        result: { path: restored, attached: true, git: "functional", omitted: [] },
      });
      expect((await desktop.client.projects.folder(project.id)).path).toBe(restored);
      const downloaded = JSON.parse(
        (await cli(["download", project.id, ...source])).stdout,
      ) as ProjectFolderRecoveryStatus;
      expect(downloaded.download).toMatchObject({ state: "complete", error: null });
      const cliStatus = projectFolderRecoveryStatusSchema.parse(JSON.parse((await cli(["status", project.id])).stdout));
      const liveStatus = await desktop.client.projects.folderRecovery(project.id);
      expect(cliStatus.download).toEqual(downloaded.download);
      expect(cliStatus.restore).toEqual(result.restore);
      expect(cliStatus.download).toEqual(liveStatus.download);
      expect(cliStatus.restore).toEqual(liveStatus.restore);
      // Attaching the restored folder schedules capture, whose live state can advance between these reads.
      for (const status of [cliStatus, liveStatus]) {
        expect(status.capture).toMatchObject({ folder: restored, error: null });
        expect(["idle", "pending", "running"]).toContain(status.capture.state);
      }
      phase("desktop restored through the CLI");

      // Exact bytes, permissions and link text; `.pstignore` and Git-ignored files apply as captured.
      const expected = await snapshotTree(folder, isDependency);
      const actual = await snapshotTree(restored);
      expect(actual).toEqual(expected);
      expect(await readFile(join(restored, ".pstignore"), "utf8")).toBe("node_modules/\n");
      expect(await readFile(join(restored, ".env"), "utf8")).toBe(`${secret}\n`);
      expect(Object.keys(actual).some((path) => path.includes("node_modules"))).toBe(false);
      // Git sees the same commits, branches, reflog, staged and unstaged work; only excluded dependencies are gone.
      const sourceGit = gitState(folder);
      sourceGit.status = sourceGit.status
        .split("\n")
        .filter((line) => !line.includes("node_modules/"))
        .join("\n");
      expect(gitState(restored)).toEqual(sourceGit);
      gitOutput(restored, "fsck", "--full", "--no-progress");
      await expect(lstat(hookMarker)).rejects.toThrow();

      // An existing destination, even an empty one, is refused without writes.
      const existing = join(root, "existing");
      await mkdir(existing);
      const refused = await cli(["restore", project.id, ...source, "--path", existing], 1);
      expect(refused.stderr).toContain("exists");
      expect(await readdir(existing)).toEqual([]);

      // A folder created while the restore runs is kept; the restore fails instead of replacing it.
      const racing = join(root, "racing");
      const running = await desktop.client.projects.restoreFolder(project.id, {
        deviceId: laptopDevice,
        sourceId: listed.sourceId,
        path: racing,
      });
      await mkdir(racing);
      await writeFile(join(racing, "local-work.txt"), "created while restoring");
      expect(running.restore.state).toBe("running");
      const raced = await waitForValue(
        () => desktop.client.projects.folderRecovery(project.id),
        (status) => status?.restore.state !== "running",
      );
      expect(raced.restore).toMatchObject({ state: "failed", error: { code: "destination_created" } });
      expect(await readdir(racing)).toEqual(["local-work.txt"]);
      expect((await readdir(root)).filter((name) => name.startsWith("."))).toEqual([]);
      phase("existing and concurrently created destinations kept");

      // The restored folder is now the desktop's own source; the laptop's copy stays restorable beside it.
      await waitFor(async () => !!(await ownCopy(desktop, project.id)));
      expect((await ownCopy(desktop, project.id))?.folder).toBe(restored);
      expect(await listedCopy(desktop, project.id, laptopDevice)).toMatchObject({ available: true });

      // The other account captured only its own folder and never sees this account's project or copy.
      await waitFor(async () => !!(await ownCopy(other, otherProject.id)));
      expect((await other.client.projects.folderSources(otherProject.id)).map((copy) => copy.current)).toEqual([true]);
      expect(await other.client.projects.get(project.id).catch(() => null)).toBeNull();
      expect(await desktop.client.projects.get(otherProject.id).catch(() => null)).toBeNull();

      // Cloud holds only ciphertext: no names, credentials or file bytes of either account.
      const stored = [
        ...peer.blobContents(),
        ...[...peer.documents.values()].flatMap((document) => [
          Buffer.from(document.payload ?? "", "base64"),
          ...document.updates.map((update) => Buffer.from(update.payload, "base64")),
        ]),
      ];
      const sample = (await readFile(join(folder, "data/model.bin"))).subarray(4096, 4160);
      for (const bytes of stored)
        for (const known of [secret, secondSecret, privateName, "saved without a commit", sample])
          expect(bytes.includes(known)).toBe(false);
      phase("relay holds no readable names, credentials or bytes");
    } finally {
      await Promise.allSettled([
        ...[laptop, desktop, other].map((device) => device && stopProcess(device.host.child)),
        peer.stop(),
      ]);
      await rm(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
