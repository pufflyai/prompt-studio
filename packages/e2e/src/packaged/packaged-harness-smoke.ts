import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const harnesses = [
  { extension: "harness-codex", id: "codex", executable: "codex" },
  { extension: "harness-claude-code", id: "claude-code", executable: "claude" },
  { extension: "harness-open-code", id: "opencode", executable: "opencode" },
];
const harnessId = ({ extension, id }: (typeof harnesses)[number]) => `pstdio.${extension}.harness.${id}`;
const upgradeHarnesses = harnesses.filter(({ executable }) => executable === "codex" || executable === "claude");

type Runtime = Awaited<ReturnType<typeof startPackagedServe>>;
interface Revision {
  manifest: { id: string };
  prebuiltRelease?: true;
  packagePath: string;
}

const withRuntime = async <T>(
  binary: string,
  home: string,
  path: string,
  run: (runtime: Runtime) => Promise<T>,
  options: { defaults?: string[]; log?: string } = {},
) => {
  await mkdir(home, { recursive: true });
  const runtime = await startPackagedServe(
    home,
    {
      PATH: path,
      PSTDIO_LOG_LEVEL: "info",
      PSTDIO_LOG_PATH: join(home, options.log ?? "smoke.jsonl"),
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(options.defaults ?? harnesses.map(({ extension }) => extension)),
      APPDATA: join(home, "app-data"),
      LOCALAPPDATA: join(home, "local-app-data"),
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, "config"),
      XDG_CACHE_HOME: join(home, "cache"),
      XDG_DATA_HOME: join(home, "data"),
      XDG_STATE_HOME: join(home, "state"),
    },
    binary,
  );
  try {
    return await run(runtime);
  } finally {
    await stopProcess(runtime.child);
  }
};

const setupEvents = async (home: string, name = "smoke.jsonl") => {
  const log = Bun.file(join(home, name));
  if (!(await log.exists())) return [];
  return (await log.text())
    .split("\n")
    .slice(0, -1)
    .map((line) => JSON.parse(line) as { phase?: string; state?: string });
};

const defaultsRegistered = async (home: string, log?: string) =>
  (await setupEvents(home, log)).some(
    (event) => event.phase === "default_extensions.active" && event.state === "completed",
  );

const acceptedHarnesses = async (home: string) => {
  const accepted = join(home, "cache", "extension-revisions", "accepted");
  const deadline = performance.now() + 90_000;
  do {
    const files = await readdir(accepted).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    const revisions: Revision[] = await Promise.all(
      files.filter((file) => file.endsWith(".json")).map((file) => Bun.file(join(accepted, file)).json()),
    );
    const byId = new Map(revisions.map((revision) => [revision.manifest.id, revision]));
    const installed = harnesses.flatMap((harness) => {
      const revision = byId.get(`pstdio.${harness.extension}`);
      return revision ? [{ ...harness, revision }] : [];
    });
    if (installed.length === harnesses.length && (await defaultsRegistered(home))) return installed;
    await Bun.sleep(200);
  } while (performance.now() < deadline);
  throw new Error("Timed out waiting for the three harness extensions to be accepted");
};

const dependencyInstalls = async (home: string) =>
  (await setupEvents(home)).filter((event) => event.phase === "extension.dependencies" && event.state === "started")
    .length;

const getJson = async <T>(
  runtime: Runtime,
  pathname: string,
  request?: { method: "POST"; body?: object },
): Promise<T> => {
  const response = await fetch(new URL(pathname, runtime.baseUrl), {
    method: request?.method,
    headers: { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" },
    body: request?.body && JSON.stringify(request.body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${pathname} failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T>;
};

const checkAvailability = async (runtime: Runtime, selected = harnesses, projectId?: string) => {
  const project = projectId ? `&projectId=${encodeURIComponent(projectId)}` : "";
  await Promise.all(
    selected.map(async (harness) => {
      const id = harnessId(harness);
      const result = await getJson<{ type: string; reason?: string }>(
        runtime,
        `/v1/agents/availability?agent=${encodeURIComponent(id)}${project}`,
      );
      assert.equal(result.type, "INSTALLED", `${id}: ${result.reason ?? result.type}`);
    }),
  );
};

const checkModels = async (runtime: Runtime, selected = harnesses, projectId?: string) => {
  const project = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  await Promise.all(
    selected.map(async (harness) => {
      const id = harnessId(harness);
      const { items } = await getJson<{ items: unknown[] }>(
        runtime,
        `/v1/agents/${encodeURIComponent(id)}/models/query${project}`,
      );
      assert.ok(items.length > 0, `${id} returned no models without signing in`);
    }),
  );
};

type ProjectExtension = { id: string; installName: string; version: string; enabled: boolean; canUpgrade: boolean };

const projectHarnesses = async (runtime: Runtime, projectId: string) => {
  const route = `/v1/projects/${encodeURIComponent(projectId)}/extensions`;
  const { extensions } = await getJson<{ extensions: ProjectExtension[] }>(runtime, route);
  return upgradeHarnesses.map(({ extension }) => {
    const installed = extensions.find(({ installName }) => installName === extension);
    assert.ok(installed?.enabled, `${extension} must be enabled in the existing project`);
    return installed;
  });
};

const createProject = async (runtime: Runtime, folder: string) => {
  await mkdir(folder, { recursive: true });
  const project = await getJson<{ id: string; extension_warnings?: unknown[] }>(runtime, "/v1/projects", {
    method: "POST",
    body: { initial_workspace: { provider_id: "pstdio.root", params: { path: folder } } },
  });
  assert.deepEqual(project.extension_warnings ?? [], []);
  return project.id;
};

const checkUpgrade = async (previous: string, candidate: string, home: string, path: string) => {
  const defaults = upgradeHarnesses.map(({ extension }) => extension);
  const previousLog = "previous.jsonl";
  const projectId = await withRuntime(
    previous,
    home,
    path,
    async (runtime) => {
      const deadline = performance.now() + 90_000;
      while (
        !(await defaultsRegistered(home, previousLog)) ||
        !(await setupEvents(home, previousLog)).some(({ phase }) => phase === "extensions_ready")
      ) {
        assert.ok(performance.now() < deadline, "The published baseline did not finish preparing its extensions");
        await Bun.sleep(200);
      }
      for (const extension of defaults) {
        const { version } = await Bun.file(join(home, "extensions", extension, "package.json")).json();
        console.log(`Previous profile has ${extension} ${version}`);
      }
      return createProject(runtime, join(home, "existing-project"));
    },
    { defaults, log: previousLog },
  );
  await withRuntime(
    candidate,
    home,
    path,
    async (runtime) => {
      const route = `/v1/projects/${encodeURIComponent(projectId)}/extensions`;
      const installed = await projectHarnesses(runtime, projectId);
      await Promise.all(
        installed
          .filter(({ canUpgrade }) => canUpgrade)
          .map(async ({ id, installName }) => {
            const result = await getJson<{ changed: boolean }>(runtime, `${route}/${encodeURIComponent(id)}/upgrade`, {
              method: "POST",
            });
            assert.ok(result.changed, `${installName} did not upgrade`);
          }),
      );
      for (const { installName, version } of await projectHarnesses(runtime, projectId))
        console.log(`Candidate profile has ${installName} ${version}`);
      // A real workspace provision starts the upgraded harness workers before our first CLI request.
      // Workers are shared by source revision across projects on the same desktop runtime.
      await createProject(runtime, join(home, "project-to-provision"));
      await checkAvailability(runtime, upgradeHarnesses, projectId);
      await checkModels(runtime, upgradeHarnesses, projectId);
    },
    { defaults, log: "upgrade.jsonl" },
  );
  console.log(
    "Codex and Claude Code detected their native CLIs and listed models on the first launch of the upgraded profile",
  );
};

const checkFreshAndPath = async (binary: string, root: string, path: string, tools: string) => {
  const fresh = join(root, "fresh");
  const pinned = await withRuntime(binary, fresh, path, async (runtime) => {
    const installed = await acceptedHarnesses(fresh);
    assert.equal(await dependencyInstalls(fresh), 0, "Ordinary startup began installing a harness CLI");
    for (const { extension, revision } of installed) {
      assert.ok(revision.prebuiltRelease, `${extension} did not load an embedded prebuilt revision`);
    }
    await checkAvailability(runtime);
    await checkModels(runtime);
    assert.equal(
      await dependencyInstalls(fresh),
      harnesses.length,
      "Each missing CLI should install once on first use",
    );
    return installed;
  });
  console.log("Fresh install reached readiness before installing the three pinned CLIs and listing their models");

  await withRuntime(binary, fresh, path, async (runtime) => {
    await checkAvailability(runtime);
    assert.equal(await dependencyInstalls(fresh), harnesses.length, "Restart downloaded a CLI again");
  });
  console.log("Restart reused all three installed private CLIs");

  for (const { executable, revision } of pinned) {
    // OpenCode's npm entry is a shim. Use the platform executable as a normal external install would.
    const bin =
      executable === "opencode"
        ? [
            "@opencode",
            `cli-${process.platform}-${process.arch}${process.arch === "x64" ? "-baseline" : ""}`,
            "bin",
            executable,
          ]
        : [".bin", executable];
    const installed = join(revision.packagePath, "node_modules", ...bin);
    await access(installed);
    await symlink(installed, join(tools, executable));
  }
  const usePath = join(root, "with-path");
  await withRuntime(binary, usePath, path, async (runtime) => {
    await acceptedHarnesses(usePath);
    await checkAvailability(runtime);
    assert.equal(await dependencyInstalls(usePath), 0, "The host installed a CLI already on PATH");
  });
  console.log("A clean home detected the three CLIs on PATH without installing private copies");
};

const [, , candidate, previous, mode] = process.argv;
assert.ok(candidate, "Usage: bun packaged-harness-smoke.ts <packaged pstdio> [<previous pstdio> [--upgrade-only]]");
assert.ok(!mode || (mode === "--upgrade-only" && previous), "An upgrade-only check needs a published baseline");
const binary = resolve(candidate);
const node = Bun.which("node");
assert.ok(node, "The release workflow must supply Node for native CLI launchers");
const root = await mkdtemp(join(tmpdir(), "pstdio-packaged-harness-"));
try {
  const tools = join(root, "bin");
  await mkdir(tools);
  const git = Bun.which("git");
  const windows = process.platform === "win32";
  if (!windows) await symlink(node, join(tools, "node"));
  const path = (
    windows
      ? [dirname(node), git && dirname(git), join(process.env.SystemRoot ?? "C:\\Windows", "System32")]
      : [tools, "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
  )
    .filter(Boolean)
    .join(delimiter);
  for (const { executable } of harnesses) {
    assert.equal(Bun.which(executable, { PATH: path }), null, `${executable} leaked into the isolated PATH`);
  }

  if (previous) await checkUpgrade(resolve(previous), binary, join(root, "upgraded"), path);
  if (!mode) await checkFreshAndPath(binary, root, path, tools);
} finally {
  await rm(root, { recursive: true, force: true });
}
