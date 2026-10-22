import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { owners, seedOwner, type Workload, workload } from "storage-scale-fixture";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { preparePlannerSource } from "../packaged/packaged-planner-source";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "../packaged/packaged-serve-helpers";

export const startScaleRuntime = async (home: string) => {
  const before = performance.now();
  const runtime = await startPackagedServe(home, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
  const startupMs = performance.now() - before;
  const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
  const request = async <T>(path: string, method = "GET", data?: unknown) => {
    const response = await fetch(`${runtime.baseUrl}${path}`, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}: ${text}`);
    return JSON.parse(text) as T;
  };
  const execute = async <T>(projectId: string, extensionId: string, command: string, params: unknown) => {
    const before = performance.now();
    const reply = await request<{ outcome: { status: string; value: T } }>(
      `/v1/projects/${projectId}/extensions/commands/${extensionId}.command.${command}/execute`,
      "POST",
      { params },
    );
    if (reply.outcome.status !== "success") throw new Error(JSON.stringify(reply));
    return { value: reply.outcome.value, sdkRequestMs: performance.now() - before };
  };
  return { ...runtime, startupMs, request, execute, stop: () => stopProcess(runtime.child) };
};
export type ScaleRuntime = Awaited<ReturnType<typeof startScaleRuntime>>;

const install = (runtime: ScaleRuntime, home: string, source: string, name: string) => {
  execFileSync(PACKAGED_BINARY_PATH, ["extensions", "add", source, "--name", name, "--force"], {
    cwd: join(home, "project"),
    env: {
      ...process.env,
      HOME: home,
      PSTDIO_HOME: home,
      PSTDIO_API_URL: runtime.baseUrl,
      PSTDIO_API_TOKEN: runtime.descriptor.token,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
};

export const seedScaleRuntime = async (home: string, kind: Workload, churn: boolean) => {
  mkdirSync(home, { recursive: true });
  const runtime = await startScaleRuntime(home);
  try {
    const folder = join(home, "project");
    mkdirSync(folder, { recursive: true });
    const project = await runtime.request<{ id: string }>(
      "/v1/projects",
      "POST",
      folderProjectInput({ name: "Scale" }, folder),
    );
    const planner = await preparePlannerSource(join(home, "sources"));
    const result = await Bun.build({
      entrypoints: [join(import.meta.dirname, "storage-scale-extension.ts")],
      target: "bun",
      external: ["@pstdio/sdk/extensions"],
      outdir: join(home, "command"),
      naming: "scale.ts",
    });
    if (!result.success) throw new AggregateError(result.logs, "Building scale fixture failed");
    const command = readFileSync(join(home, "command", "scale.ts"), "utf8");
    writeFileSync(join(planner, "scale.ts"), command);
    const entry = join(planner, "extension.ts");
    writeFileSync(
      entry,
      `import { fixtureCommands } from "./scale";\n${readFileSync(entry, "utf8").replace(
        "commands: [...plannerCommands,",
        "commands: [...fixtureCommands, ...plannerCommands,",
      )}`,
    );
    install(runtime, home, planner, "pstdio-planner");
    const manifest = JSON.parse(readFileSync(join(planner, "package.json"), "utf8"));
    for (const owner of owners(workload(kind))) {
      if (owner.index !== 9) {
        const source = join(home, "sources", `scale-owner-${owner.index}`);
        mkdirSync(source, { recursive: true });
        writeFileSync(join(source, "extension.ts"), command);
        writeFileSync(
          join(source, "package.json"),
          JSON.stringify({
            name: `scale-owner-${owner.index}`,
            publisher: "scale",
            version: "1.0.0",
            main: "extension.ts",
            engines: { pstdio: `^${EXTENSION_API_VERSION}` },
            dependencies: { "@pstdio/sdk": manifest.dependencies["@pstdio/sdk"] },
          }),
        );
        install(runtime, home, source, `scale-owner-${owner.index}`);
      }
      const plannerOwner = owner.index === 9;
      if (plannerOwner) await runtime.execute(project.id, owner.id, "ticket-status.read", {});
      const target = {
        commit: (input: Parameters<Parameters<typeof seedOwner>[0]["commit"]>[0]) =>
          runtime.execute(project.id, owner.id, "scale", {
            input: { action: "seed", ...input, count: owner.rows, planner: plannerOwner },
          }),
      };
      await seedOwner(target, kind, owner.index, owner.rows, false, (progress) => {
        if (progress.completed % 1_000 === 0)
          process.stderr.write(`${kind} ${owner.id}: edit ${progress.history} ${progress.completed}/${owner.rows}\n`);
      });
      if (churn) await seedOwner(target, kind, owner.index, owner.rows, true, () => {});
    }
    const fixture = { projectId: project.id, kind, churn };
    await configureScaleView(runtime, project.id, "board");
    writeFileSync(join(home, "scale-project.json"), JSON.stringify(fixture));
    return fixture;
  } finally {
    await runtime.stop();
  }
};

export const configureScaleView = async (runtime: ScaleRuntime, projectId: string, mode: "board" | "list") => {
  const path = `/v1/projects/${projectId}/boards/pstdio.pstdio-planner.view.tickets/views`;
  const view = await runtime.request<{ id: string }>(path, "POST", {
    title: `Scale ${mode}`,
    settings: { viewMode: mode, rowGrouping: "none", columnGrouping: "status", displayProperties: ["id"] },
    filter: {
      conjunction: "and",
      rules: [
        { attributeId: "archived", condition: "is-any-of", value: ["active"] },
        { attributeId: "status", condition: "is-any-of", value: ["ready"] },
      ],
    },
    sorts: [],
  });
  await runtime.request(`${path}/default`, "PUT", { viewId: view.id });
};
