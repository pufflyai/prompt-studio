import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const harnesses = [
  { extension: "harness-codex", id: "codex", executable: "codex" },
  { extension: "harness-claude-code", id: "claude-code", executable: "claude" },
  { extension: "harness-open-code", id: "opencode", executable: "opencode" },
];
const harnessId = ({ extension, id }: (typeof harnesses)[number]) => `pstdio.${extension}.harness.${id}`;

type Runtime = Awaited<ReturnType<typeof startPackagedServe>>;
interface Revision {
  manifest: { id: string };
  prebuiltRelease?: true;
  packagePath: string;
}

const withRuntime = async <T>(binary: string, home: string, path: string, run: (runtime: Runtime) => Promise<T>) => {
  await mkdir(home, { recursive: true });
  const runtime = await startPackagedServe(
    home,
    {
      PATH: path,
      PSTDIO_LOG_LEVEL: "info",
      PSTDIO_LOG_PATH: join(home, "smoke.jsonl"),
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(harnesses.map(({ extension }) => extension)),
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

const setupEvents = async (home: string) => {
  const log = Bun.file(join(home, "smoke.jsonl"));
  if (!(await log.exists())) return [];
  return (await log.text())
    .split("\n")
    .slice(0, -1)
    .map((line) => JSON.parse(line) as { phase?: string; state?: string });
};

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
    if (
      installed.length === harnesses.length &&
      (await setupEvents(home)).some(
        (event) => event.phase === "default_extensions.active" && event.state === "completed",
      )
    )
      return installed;
    await Bun.sleep(200);
  } while (performance.now() < deadline);
  throw new Error("Timed out waiting for the three harness extensions to be accepted");
};

const dependencyInstalls = async (home: string) =>
  (await setupEvents(home)).filter((event) => event.phase === "extension.dependencies" && event.state === "started")
    .length;

const getJson = async <T>(runtime: Runtime, pathname: string): Promise<T> => {
  const response = await fetch(new URL(pathname, runtime.baseUrl), {
    headers: runtimeAuthorization(runtime.descriptor),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${pathname} failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T>;
};

const checkAvailability = async (runtime: Runtime) => {
  await Promise.all(
    harnesses.map(async (harness) => {
      const id = harnessId(harness);
      const result = await getJson<{ type: string; reason?: string }>(
        runtime,
        `/v1/agents/availability?agent=${encodeURIComponent(id)}`,
      );
      assert.equal(result.type, "INSTALLED", `${id}: ${result.reason ?? result.type}`);
    }),
  );
};

const checkModels = async (runtime: Runtime) => {
  await Promise.all(
    harnesses.map(async (harness) => {
      const id = harnessId(harness);
      const { items } = await getJson<{ items: unknown[] }>(
        runtime,
        `/v1/agents/${encodeURIComponent(id)}/models/query`,
      );
      assert.ok(items.length > 0, `${id} returned no models without signing in`);
    }),
  );
};

const [, , candidate, previous] = process.argv;
assert.ok(candidate, "Usage: bun packaged-harness-smoke.ts <packaged pstdio> [<previous pstdio>]");
const binary = resolve(candidate);
const node = Bun.which("node");
assert.ok(node, "The release workflow must supply Node for native CLI launchers");
const root = await mkdtemp(join(tmpdir(), "pstdio-packaged-harness-"));
try {
  const tools = join(root, "bin");
  await mkdir(tools);
  await symlink(node, join(tools, "node"));
  const path = [tools, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(delimiter);
  for (const { executable } of harnesses) {
    assert.equal(Bun.which(executable, { PATH: path }), null, `${executable} leaked into the isolated PATH`);
  }

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

  if (previous) {
    await rm(fresh, { recursive: true });
    for (const { executable } of harnesses) await rm(join(tools, executable));
    const upgraded = join(root, "upgraded");
    await withRuntime(resolve(previous), upgraded, path, () => acceptedHarnesses(upgraded));
    await withRuntime(binary, upgraded, path, async (runtime) => {
      await acceptedHarnesses(upgraded);
      await checkAvailability(runtime);
    });
    console.log("The packaged candidate detected all three harnesses in a home created by the previous release");
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
