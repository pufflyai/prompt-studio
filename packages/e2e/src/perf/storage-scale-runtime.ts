import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { owners, type SeedTarget, seedOwner, type Workload, workload } from "storage-scale-fixture";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { preparePlannerSource } from "../packaged/packaged-planner-source";
import {
  type PackagedRuntimeObservation,
  runtimeAuthorization,
  startPackagedServe,
  stopProcess,
} from "../packaged/packaged-serve-helpers";
import { configuredContainer, startContainerRuntime } from "./storage-scale-container";

export interface ScaleFixture {
  projectId: string;
  kind: Workload;
  churn: boolean;
}

const fixtureCommand = () => {
  const path = join(import.meta.dirname, "../../dist/storage-scale/scale.js");
  if (!existsSync(path)) throw new Error("Run bun run --cwd packages/e2e perf:storage-scale:build before preparation");
  return readFileSync(path, "utf8");
};

interface ScaleBackend {
  descriptor: Awaited<ReturnType<typeof startPackagedServe>>["descriptor"];
  baseUrl: string;
  controlEvidence: object;
  controlPreparationMs: number;
  stop(): Promise<void>;
  crash(): Promise<void>;
  completeLoginCallback(url: string): Promise<void>;
}

const connectScaleRuntime = (runtime: ScaleBackend, startupMs: number) => {
  const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
  const client = createClient({ baseUrl: runtime.baseUrl, token: runtime.descriptor.token });
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
    const reply = await client.extensions.execute(`${extensionId}.command.${command}`, {
      projectId,
      params: params as Record<string, unknown>,
    });
    if (reply.outcome.status !== "success") throw new Error(JSON.stringify(reply));
    return { value: reply.outcome.value as T, sdkRequestMs: performance.now() - before };
  };
  return { ...runtime, client, startupMs, request, execute };
};

export const startNativeScaleRuntime = async (
  home: string,
  environment: Record<string, string> = {},
  observe?: (process: PackagedRuntimeObservation) => void,
) => {
  const before = performance.now();
  const native = await startPackagedServe(
    home,
    { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1", ...environment },
    undefined,
    observe,
  );
  return connectScaleRuntime(
    {
      descriptor: native.descriptor,
      baseUrl: native.baseUrl,
      controlEvidence: { cgroup: null },
      controlPreparationMs: 0,
      stop: () => stopProcess(native.child),
      completeLoginCallback: async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Completing diagnostic login: HTTP ${response.status}`);
      },
      crash: async () => {
        if (native.child.exitCode !== null || native.child.signalCode !== null) return;
        const exited = new Promise<void>((resolve) => native.child.once("exit", () => resolve()));
        native.child.kill("SIGKILL");
        await exited;
      },
    },
    performance.now() - before,
  );
};

export const startScaleRuntime = async (
  home: string,
  environment: Record<string, string> = {},
  observe?: (process: PackagedRuntimeObservation) => void,
) => {
  const container = configuredContainer(home);
  if (!container) return startNativeScaleRuntime(home, environment, observe);
  const before = performance.now();
  const runtime = await startContainerRuntime(container, environment);
  return connectScaleRuntime(runtime, performance.now() - before - runtime.controlPreparationMs);
};
export type ScaleRuntime = Awaited<ReturnType<typeof startScaleRuntime>>;

const plannerFixtureImport = 'import { fixtureCommands, plannerStorageIndexes } from "./scale";\n';

// Planner keeps its own entry; the fixture adds its commands and the shared scale indexes, which
// install before any fixture ticket is written.
export const extendPlannerSource = (planner: string) => {
  const entry = join(planner, "extension.ts");
  // Start from Planner's own entry, also when an older harness already extended it.
  const original = readFileSync(entry, "utf8")
    .replace(/^import \{[^}]*\} from "\.\/scale";\n/, "")
    .replace(/\.\.\.fixtureCommands,\s*/, "")
    .replace(/\n {2}storageIndexes: plannerStorageIndexes,/, "");
  const extended = original
    .replace(/commands: \[(\s*)\.\.\.plannerCommands,/, "commands: [$1...fixtureCommands,$1...plannerCommands,")
    .replace(
      "export default defineExtension({",
      "export default defineExtension({\n  storageIndexes: plannerStorageIndexes,",
    );
  // Fail before seeding the other owners if Planner's entry no longer matches.
  if (!extended.includes("...fixtureCommands,") || !extended.includes("storageIndexes: plannerStorageIndexes"))
    throw new Error("Planner extension.ts no longer matches the fixture's command and index additions");
  writeFileSync(entry, `${plannerFixtureImport}${extended}`);
};
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

export const refreshScaleSources = async (home: string, kind: Workload) => {
  const command = fixtureCommand();
  const runtime = await startScaleRuntime(home);
  try {
    const planner = join(home, "sources", "extension-source");
    writeFileSync(join(planner, "scale.ts"), command);
    extendPlannerSource(planner);
    install(runtime, home, planner, "pstdio-planner");
    for (const owner of owners(workload(kind)).filter((owner) => owner.index !== 9)) {
      const source = join(home, "sources", `scale-owner-${owner.index}`);
      writeFileSync(join(source, "scale.ts"), command);
      writeFileSync(
        join(source, "extension.ts"),
        `import { defineExtension } from "@pstdio/sdk/extensions";\nimport { fixtureCommands, createScaleViews, ownerStorageIndexes } from "./scale";\nconst ui = createScaleViews(${JSON.stringify(kind)}, ${owner.index}, ${owner.rows});\nexport default defineExtension({ ...ui, storageIndexes: ownerStorageIndexes, commands: [...fixtureCommands, ...ui.commands] });\n`,
      );
      install(runtime, home, source, `scale-owner-${owner.index}`);
    }
  } finally {
    await runtime.stop();
  }
};

export const seedScaleRuntime = async (home: string, kind: Workload, churn: boolean) => {
  const command = fixtureCommand();
  mkdirSync(home, { recursive: true });
  const runtime = await startScaleRuntime(home);
  try {
    const folder = join(home, "project");
    mkdirSync(folder, { recursive: true });
    const projects = await runtime.request<{ id: string }[]>("/v1/projects");
    if (projects.length > 1) throw new Error("Expected a disposable fixture with one project");
    const project =
      projects[0] ??
      (await runtime.request<{ id: string }>("/v1/projects", "POST", folderProjectInput({ name: "Scale" }, folder)));
    const planner = await preparePlannerSource(join(home, "sources"));
    writeFileSync(join(planner, "scale.ts"), command);
    extendPlannerSource(planner);
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
      const target: SeedTarget = {
        commit: (input) =>
          runtime.execute(project.id, owner.id, "scale", {
            input: { action: "seed", ...input, count: owner.rows, planner: plannerOwner },
          }),
        // Planner creates each ticket, with its core number, through its public ticket command.
        ...(plannerOwner && {
          create: async (rows) => {
            const tickets: string[] = [];
            for (const row of rows) {
              const { value } = await runtime.execute<{ id: string }>(project.id, owner.id, "create-ticket", {
                title: row.title,
              });
              tickets.push(value.id);
            }
            await runtime.execute(project.id, owner.id, "scale", {
              input: { action: "adopt", rows, tickets, count: owner.rows, planner: true },
            });
          },
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
